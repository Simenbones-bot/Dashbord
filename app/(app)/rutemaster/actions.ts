"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { kommendeDatoer } from "./dates";

function tekstEllerNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function tallEllerNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type OpprettResultat = { ok: true } | { ok: false; feil: string };

/** Oppretter en ny rute knyttet til den innloggede brukerens enhet. */
export async function opprettRute(
  formData: FormData,
): Promise<OpprettResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  // Finn brukerens enhet (RLS krever at ruten knyttes til en enhet du har tilgang til).
  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id")
    .eq("id", user.id)
    .single();

  if (!profile?.unit_id) {
    return { ok: false, feil: "Brukeren din er ikke koblet til en enhet." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, feil: "Rutenavn må fylles ut." };
  }

  const interval = tallEllerNull(formData.get("interval_days"));

  const { error } = await supabase.from("route").insert({
    unit_id: profile.unit_id,
    name,
    route_number: tekstEllerNull(formData.get("route_number")),
    customer_id: tekstEllerNull(formData.get("customer_id")),
    vehicle_id: tekstEllerNull(formData.get("vehicle_id")),
    driver_id: tekstEllerNull(formData.get("driver_id")),
    co_driver_id: tekstEllerNull(formData.get("co_driver_id")),
    start_time: tekstEllerNull(formData.get("start_time")),
    end_time: tekstEllerNull(formData.get("end_time")),
    distance_km: tallEllerNull(formData.get("distance_km")),
    interval_days: interval && interval > 0 ? Math.round(interval) : 1,
    revenue_per_hour: tallEllerNull(formData.get("revenue_per_hour")),
  });

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/rutemaster");
  return { ok: true };
}

// ---------- Generere vakter ----------

export type GenererResultat =
  | { ok: true; antall: number }
  | { ok: false; feil: string };

/**
 * Lager vakter 1 uke frem (i dag + 6 dager) for alle aktive ruter i brukerens enhet.
 * En rute kjøres dag nr. i hvis i (0 = i dag) går opp i rutens intervall.
 * Trygt å kjøre flere ganger – doble vakter hoppes over (unik rute+dato).
 */
export async function genererVakter(): Promise<GenererResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id")
    .eq("id", user.id)
    .single();
  if (!profile?.unit_id) {
    return { ok: false, feil: "Brukeren din er ikke koblet til en enhet." };
  }

  const { data: ruter, error: ruteFeil } = await supabase
    .from("route")
    .select(
      "id, interval_days, start_time, end_time, vehicle_id, driver_id, co_driver_id",
    )
    .eq("active", true);
  if (ruteFeil) return { ok: false, feil: ruteFeil.message };
  if (!ruter || ruter.length === 0) {
    return { ok: false, feil: "Ingen aktive ruter å generere vakter fra." };
  }

  const datoer = kommendeDatoer(7);

  // Bygg datetime-streng (lokal tid) fra dato + klokkeslett, ellers null.
  const stempel = (dato: string, tid: string | null) =>
    tid ? `${dato}T${tid.slice(0, 5)}:00` : null;

  type NyVakt = {
    unit_id: string;
    route_id: string;
    date: string;
    planned_start: string | null;
    planned_end: string | null;
    vehicle_id: string | null;
    driver_id: string | null;
    co_driver_id: string | null;
  };

  const rader: NyVakt[] = [];
  datoer.forEach((dato, i) => {
    for (const r of ruter) {
      const intervall = r.interval_days && r.interval_days > 0 ? r.interval_days : 1;
      if (i % intervall !== 0) continue;
      rader.push({
        unit_id: profile.unit_id,
        route_id: r.id,
        date: dato,
        planned_start: stempel(dato, r.start_time),
        planned_end: stempel(dato, r.end_time),
        vehicle_id: r.vehicle_id,
        driver_id: r.driver_id,
        co_driver_id: r.co_driver_id,
      });
    }
  });

  if (rader.length === 0) return { ok: true, antall: 0 };

  // ignoreDuplicates: hopp over vakter som allerede finnes (unik rute+dato).
  const { data, error } = await supabase
    .from("shift")
    .upsert(rader, { onConflict: "route_id,date", ignoreDuplicates: true })
    .select("id");

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/rutemaster");
  return { ok: true, antall: data?.length ?? 0 };
}
