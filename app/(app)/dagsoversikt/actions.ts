"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SjaforResultat = { ok: true } | { ok: false; feil: string };

/**
 * Setter (eller fjerner) planlagt sjåfør på en vakt fra dagsoversikten.
 * Tom streng = fjern sjåfør.
 *
 * Henger sammen med stemplingen: finnes det allerede en stempling på vakten,
 * oppdateres også dens sjåfør, slik at planlagt og faktisk sjåfør holdes i synk.
 * Er vakten ikke stemplet ennå, blir sjåføren forhåndsvalgt på stemplingssiden.
 */
export async function settSjaforPaVakt(
  shiftId: string,
  driverId: string,
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
    .select("unit_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!vakt) return { ok: false, feil: "Fant ikke vakten." };

  // En valgt sjåfør må høre til samme enhet som vakten.
  if (driver) {
    const { data: d } = await supabase
      .from("driver")
      .select("unit_id")
      .eq("id", driver)
      .maybeSingle();
    if (!d || d.unit_id !== vakt.unit_id) {
      return { ok: false, feil: "Sjåføren hører ikke til samme enhet som vakten." };
    }
  }

  // 1) Sett planlagt sjåfør på vakten.
  const { error: e1 } = await supabase
    .from("shift")
    .update({ driver_id: driver })
    .eq("id", shiftId);
  if (e1) return { ok: false, feil: e1.message };

  // 2) Hold en eventuell stempling i synk med valget.
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

  revalidatePath("/dagsoversikt");
  return { ok: true };
}
