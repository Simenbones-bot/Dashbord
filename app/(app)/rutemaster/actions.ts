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

// "HH:MM" eller "HH:MM:SS" → minutter etter midnatt.
function tilMinutter(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

const DAG_NAVN: Record<number, string> = {
  1: "mandag",
  2: "tirsdag",
  3: "onsdag",
  4: "torsdag",
  5: "fredag",
  6: "lørdag",
  7: "søndag",
};

type RuteFelter = {
  vehicle_ids: string[];
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
};

/**
 * Leter etter en eksisterende, aktiv rute som overlapper i tid på SAMME bil og
 * SAMME ukedag som de nye feltene. Returnerer en feilmelding hvis det finnes en
 * kollisjon, ellers null. `excludeId` hopper over ruten man redigerer.
 */
async function finnOverlapp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unitId: string,
  felter: RuteFelter,
  excludeId: string | null,
): Promise<string | null> {
  // Uten tildelt bil eller uten starttid kan ingenting kollidere på tidslinjen.
  if (felter.vehicle_ids.length === 0 || !felter.start_time) return null;

  const nyStart = tilMinutter(felter.start_time);
  const nySlutt = felter.end_time ? tilMinutter(felter.end_time) : nyStart + 60;

  let q = supabase
    .from("route")
    .select("id, name, route_number, vehicle_ids, weekdays, start_time, end_time")
    .eq("unit_id", unitId)
    .eq("active", true);
  if (excludeId) q = q.neq("id", excludeId);

  const { data, error } = await q;
  if (error || !data) return null; // ved feil lar vi DB/RLS evt. stoppe det

  for (const r of data) {
    if (!r.start_time) continue;
    const delerBil = (r.vehicle_ids ?? []).some((id: string) =>
      felter.vehicle_ids.includes(id),
    );
    if (!delerBil) continue;
    const fellesDager = (r.weekdays ?? []).filter((d: number) =>
      felter.weekdays.includes(d),
    );
    if (fellesDager.length === 0) continue;

    const s = tilMinutter(r.start_time);
    const e = r.end_time ? tilMinutter(r.end_time) : s + 60;
    // Overlapp: ny start før eksisterende slutt OG eksisterende start før ny slutt.
    if (nyStart < e && s < nySlutt) {
      const navn =
        (r.route_number ? r.route_number + " · " : "") + (r.name ?? "rute");
      const dager = fellesDager
        .sort((a: number, b: number) => a - b)
        .map((d: number) => DAG_NAVN[d] ?? d)
        .join(", ");
      return `Kjøringen overlapper med «${navn}» på samme bil (${dager}). Velg annen tid, bil eller dag.`;
    }
  }
  return null;
}

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

  const overlapp = await finnOverlapp(
    supabase,
    profile.unit_id,
    felter.data as unknown as RuteFelter,
    null,
  );
  if (overlapp) return { ok: false, feil: overlapp };

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

  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id")
    .eq("id", user.id)
    .single();
  if (profile?.unit_id) {
    const overlapp = await finnOverlapp(
      supabase,
      profile.unit_id,
      felter.data as unknown as RuteFelter,
      id, // hopp over ruten vi redigerer
    );
    if (overlapp) return { ok: false, feil: overlapp };
  }

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
