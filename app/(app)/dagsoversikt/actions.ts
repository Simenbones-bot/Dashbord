"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SjaforResultat = { ok: true } | { ok: false; feil: string };

// Hvilken plass på vakten vi setter: hovedsjåfør eller sidemann.
export type SjaforFelt = "driver_id" | "co_driver_id";

// Tilhørende kolonner for fast sjåfør på ruten + relasjon.
const FAST_KOLONNE: Record<SjaforFelt, "default_driver_id" | "default_co_driver_id"> = {
  driver_id: "default_driver_id",
  co_driver_id: "default_co_driver_id",
};

/**
 * Setter (eller fjerner) planlagt sjåfør/sidemann på en vakt fra dagsoversikten.
 * Tom streng = fjern. `felt` velger plassen (hovedsjåfør eller sidemann).
 *
 * Henger sammen med stemplingen for HOVEDsjåføren: finnes det allerede en
 * stempling på vakten, oppdateres også dens driver, slik at planlagt og faktisk
 * holdes i synk. (Sidemann har ingen egen stempling i MVP.)
 */
export async function settSjaforPaVakt(
  shiftId: string,
  driverId: string,
  felt: SjaforFelt = "driver_id",
): Promise<SjaforResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const driver = driverId.trim() === "" ? null : driverId.trim();

  // Vakten må finnes (RLS gir bare tilgang til egne enheter).
  const { data: vakt } = await supabase
    .from("shift")
    .select("unit_id, driver_id, co_driver_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!vakt) return { ok: false, feil: "Fant ikke vakten." };

  if (driver) {
    // Sjåføren må høre til samme enhet som vakten.
    const { data: d } = await supabase
      .from("driver")
      .select("unit_id")
      .eq("id", driver)
      .maybeSingle();
    if (!d || d.unit_id !== vakt.unit_id) {
      return { ok: false, feil: "Sjåføren hører ikke til samme enhet som vakten." };
    }
    // Samme person kan ikke være både hovedsjåfør og sidemann på vakten.
    const annen = felt === "driver_id" ? vakt.co_driver_id : vakt.driver_id;
    if (annen && annen === driver) {
      return {
        ok: false,
        feil: "Sjåføren er allerede satt på den andre plassen på vakten.",
      };
    }
  }

  // 1) Sett planlagt sjåfør/sidemann på vakten.
  const { error: e1 } = await supabase
    .from("shift")
    .update({ [felt]: driver })
    .eq("id", shiftId);
  if (e1) return { ok: false, feil: e1.message };

  // 2) Hold en eventuell stempling i synk – kun for hovedsjåføren.
  if (felt === "driver_id") {
    const { data: te } = await supabase
      .from("time_entry")
      .select("id")
      .eq("shift_id", shiftId)
      .maybeSingle();
    if (te) {
      const { error: e2 } = await supabase
        .from("time_entry")
        .update({ driver_id: driver })
        .eq("id", te.id);
      if (e2) return { ok: false, feil: e2.message };
    }
  }

  revalidatePath("/dagsoversikt");
  return { ok: true };
}

// "YYYY-MM-DD" for i morgen i norsk tid.
function iMorgenOslo(): string {
  const idag = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(idag + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Setter en sjåfør (eller sidemann) FAST på ruten som vakten tilhører.
 * - Lagrer default_driver_id / default_co_driver_id på ruten, slik at nye vakter
 *   som genereres får sjåføren automatisk.
 * - Oppdaterer alle eksisterende vakter på ruten fra og med i morgen til samme
 *   sjåfør (dagens og tidligere vakter røres ikke).
 */
export async function settFastSjaforPaRute(
  shiftId: string,
  driverId: string,
  felt: SjaforFelt = "driver_id",
): Promise<SjaforResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const driver = driverId.trim();
  if (driver === "") return { ok: false, feil: "Velg en sjåfør først." };

  // Finn vakten + ruten den hører til.
  const { data: vakt } = await supabase
    .from("shift")
    .select("route_id, unit_id, driver_id, co_driver_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!vakt) return { ok: false, feil: "Fant ikke vakten." };

  // Sjåføren må høre til samme enhet som vakten.
  const { data: d } = await supabase
    .from("driver")
    .select("unit_id")
    .eq("id", driver)
    .maybeSingle();
  if (!d || d.unit_id !== vakt.unit_id) {
    return { ok: false, feil: "Sjåføren hører ikke til samme enhet som vakten." };
  }

  // Samme person kan ikke være både fast hovedsjåfør og fast sidemann.
  const annen = felt === "driver_id" ? vakt.co_driver_id : vakt.driver_id;
  if (annen && annen === driver) {
    return {
      ok: false,
      feil: "Sjåføren er allerede satt på den andre plassen på vakten.",
    };
  }

  // 1) Fast sjåfør/sidemann på ruten (brukes av vaktgenereringen for nye vakter).
  const { error: e1 } = await supabase
    .from("route")
    .update({ [FAST_KOLONNE[felt]]: driver })
    .eq("id", vakt.route_id);
  if (e1) return { ok: false, feil: e1.message };

  // 2) Oppdater alle fremtidige vakter (fra og med i morgen) på ruten.
  const { error: e2 } = await supabase
    .from("shift")
    .update({ [felt]: driver })
    .eq("route_id", vakt.route_id)
    .gte("date", iMorgenOslo());
  if (e2) return { ok: false, feil: e2.message };

  revalidatePath("/dagsoversikt");
  return { ok: true };
}
