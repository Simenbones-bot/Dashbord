"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// Leser feltene fra skjemaet til ett objekt vi kan insert-e/oppdatere.
function lesRuteFelter(formData: FormData):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; feil: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, feil: "Rutenavn må fylles ut." };

  // Ukedager (ISO 1–7). Minst én må være valgt.
  const weekdays = formData
    .getAll("weekdays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  if (weekdays.length === 0) {
    return { ok: false, feil: "Velg minst én kjøredag." };
  }

  // Tildelte biler (flere mulig).
  const vehicle_ids = formData
    .getAll("vehicle_ids")
    .map((v) => String(v))
    .filter((s) => s !== "");

  const vehicles_needed = Math.max(
    1,
    Math.round(tallEllerNull(formData.get("vehicles_needed")) ?? 1),
  );

  return {
    ok: true,
    data: {
      name,
      route_number: tekstEllerNull(formData.get("route_number")),
      customer_id: tekstEllerNull(formData.get("customer_id")),
      route_type: tekstEllerNull(formData.get("route_type")) ?? "fast_rute",
      color: tekstEllerNull(formData.get("color")) ?? "#5B5BD6",
      vehicle_category: tekstEllerNull(formData.get("vehicle_category")),
      has_co_driver: formData.get("has_co_driver") === "true",
      vehicles_needed,
      vehicle_ids,
      // Behold enkelt-kolonnen i synk (første bil) for bakoverkompatibilitet.
      vehicle_id: vehicle_ids[0] ?? null,
      start_time: tekstEllerNull(formData.get("start_time")),
      end_time: tekstEllerNull(formData.get("end_time")),
      distance_km: tallEllerNull(formData.get("distance_km")),
      weekdays,
      revenue_per_hour: tallEllerNull(formData.get("revenue_per_hour")),
    },
  };
}

/** Oppretter en ny rute knyttet til den innloggede brukerens enhet. */
export async function opprettRute(
  formData: FormData,
): Promise<OpprettResultat> {
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

  const felter = lesRuteFelter(formData);
  if (!felter.ok) return felter;

  const { error } = await supabase
    .from("route")
    .insert({ unit_id: profile.unit_id, ...felter.data });

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/rutemaster");
  return { ok: true };
}

/** Oppdaterer en eksisterende rute. */
export async function oppdaterRute(
  id: string,
  formData: FormData,
): Promise<OpprettResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const felter = lesRuteFelter(formData);
  if (!felter.ok) return felter;

  // RLS sørger for at du bare kan endre ruter i egen enhet.
  const { error } = await supabase
    .from("route")
    .update(felter.data)
    .eq("id", id);

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/rutemaster");
  return { ok: true };
}

/** Sletter en rute (og dens genererte vakter via on delete cascade). */
export async function slettRute(id: string): Promise<OpprettResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const { error } = await supabase.from("route").delete().eq("id", id);
  if (error) return { ok: false, feil: error.message };

  revalidatePath("/rutemaster");
  return { ok: true };
}
