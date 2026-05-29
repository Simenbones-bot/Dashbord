"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StempleResultat = { ok: true } | { ok: false; feil: string };

function tekstEllerNull(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// Henter enheten en vakt tilhører (og bekrefter at brukeren har tilgang via RLS).
async function vaktEnhet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("shift")
    .select("unit_id")
    .eq("id", shiftId)
    .single();
  return data?.unit_id ?? null;
}

/** Stempler INN: setter sjåfør + inn-tidspunkt på vakten. */
export async function stempleInn(
  shiftId: string,
  driverId: string,
  comment: string | null,
): Promise<StempleResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };
  if (!driverId) return { ok: false, feil: "Velg sjåfør først." };

  const unitId = await vaktEnhet(supabase, shiftId);
  if (!unitId) return { ok: false, feil: "Fant ikke vakten." };

  const { error } = await supabase.from("time_entry").upsert(
    {
      shift_id: shiftId,
      unit_id: unitId,
      driver_id: driverId,
      check_in: new Date().toISOString(),
      comment: tekstEllerNull(comment),
    },
    { onConflict: "shift_id" },
  );

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/stempling");
  return { ok: true };
}

/** Stempler UT: setter ut-tidspunkt på vakten (må være stemplet inn først). */
export async function stempleUt(
  shiftId: string,
  comment: string | null,
): Promise<StempleResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  const { data: eksisterende } = await supabase
    .from("time_entry")
    .select("id, check_in")
    .eq("shift_id", shiftId)
    .maybeSingle();

  if (!eksisterende?.check_in) {
    return { ok: false, feil: "Du må stemple inn før du stempler ut." };
  }

  const oppdatering: { check_out: string; comment?: string | null } = {
    check_out: new Date().toISOString(),
  };
  const k = tekstEllerNull(comment);
  if (k !== null) oppdatering.comment = k;

  const { error } = await supabase
    .from("time_entry")
    .update(oppdatering)
    .eq("id", eksisterende.id);

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/stempling");
  return { ok: true };
}
