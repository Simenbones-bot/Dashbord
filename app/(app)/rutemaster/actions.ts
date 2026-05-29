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
