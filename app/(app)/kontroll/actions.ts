"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type KontrollResultat = { ok: true } | { ok: false; feil: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type BrukerInfo = { feil: string } | { userId: string; navn: string };

// Henter innlogget bruker + navn (navnet lagres i revisjonsloggen).
async function brukerInfo(supabase: Supabase): Promise<BrukerInfo> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { feil: "Du er ikke innlogget." as const };

  const { data: profile } = await supabase
    .from("profile")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    navn: (profile?.full_name as string | null) ?? user.email ?? "Ukjent",
  };
}

// Lagrer (oppretter/oppdaterer) en vurdering for én vakt.
async function lagreVurdering(
  shiftId: string,
  status: "godkjent" | "avvist",
  note: string | null,
): Promise<KontrollResultat> {
  const supabase = await createClient();

  const info = await brukerInfo(supabase);
  if ("feil" in info) return { ok: false, feil: info.feil };

  // Finn vaktens enhet (RLS krever at raden knyttes til en enhet du har tilgang til).
  const { data: shift } = await supabase
    .from("shift")
    .select("unit_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift?.unit_id) return { ok: false, feil: "Fant ikke vakten." };

  const { error } = await supabase.from("shift_review").upsert(
    {
      shift_id: shiftId,
      unit_id: shift.unit_id,
      status,
      note: note?.trim() ? note.trim() : null,
      reviewed_by: info.userId,
      reviewed_by_name: info.navn,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "shift_id" },
  );
  if (error) return { ok: false, feil: error.message };

  revalidatePath("/kontroll");
  return { ok: true };
}

/** Godkjenner én vakt. */
export async function godkjennVakt(shiftId: string): Promise<KontrollResultat> {
  return lagreVurdering(shiftId, "godkjent", null);
}

/** Avviser én vakt (med valgfri begrunnelse). */
export async function avvisVakt(
  shiftId: string,
  note: string | null,
): Promise<KontrollResultat> {
  return lagreVurdering(shiftId, "avvist", note);
}

/** Angrer en vurdering (setter vakten tilbake til "ikke behandlet"). */
export async function angreVakt(shiftId: string): Promise<KontrollResultat> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_review")
    .delete()
    .eq("shift_id", shiftId);
  if (error) return { ok: false, feil: error.message };

  revalidatePath("/kontroll");
  return { ok: true };
}

type ShiftForBulk = {
  id: string;
  unit_id: string;
  time_entry: { check_out: string | null; comment: string | null }[] | null;
  vehicle_check: { status: string }[] | null;
  shift_review: { status: string }[] | null;
};

/**
 * Godkjenner automatisk alle "rene" vakter denne dagen: ferdigstemplet, uten
 * sjaforkommentar og uten bilsjekk-avvik, og som ikke alt er behandlet.
 */
export async function godkjennAlleUtenAvvik(
  date: string,
): Promise<KontrollResultat> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, feil: "Ugyldig dato." };
  }

  const supabase = await createClient();
  const info = await brukerInfo(supabase);
  if ("feil" in info) return { ok: false, feil: info.feil };

  const { data, error: hentFeil } = await supabase
    .from("shift")
    .select(
      `id, unit_id,
       time_entry ( check_out, comment ),
       vehicle_check ( status ),
       shift_review ( status )`,
    )
    .eq("date", date);
  if (hentFeil) return { ok: false, feil: hentFeil.message };

  const shifts = (data ?? []) as ShiftForBulk[];
  const naa = new Date().toISOString();

  const rader = shifts
    .filter((s) => {
      const alleredeVurdert = (s.shift_review ?? []).length > 0;
      if (alleredeVurdert) return false;
      const te = (s.time_entry ?? [])[0];
      const ferdig = !!te?.check_out;
      if (!ferdig) return false; // ikke ferdig = avvik, ma vurderes manuelt
      const harKommentar = !!te?.comment?.trim();
      const harBilavvik = (s.vehicle_check ?? []).some(
        (v) => v.status === "avvik",
      );
      return !harKommentar && !harBilavvik;
    })
    .map((s) => ({
      shift_id: s.id,
      unit_id: s.unit_id,
      status: "godkjent" as const,
      reviewed_by: info.userId,
      reviewed_by_name: info.navn,
      reviewed_at: naa,
    }));

  if (rader.length === 0) {
    return { ok: false, feil: "Ingen vakter uten avvik å godkjenne." };
  }

  const { error } = await supabase
    .from("shift_review")
    .upsert(rader, { onConflict: "shift_id" });
  if (error) return { ok: false, feil: error.message };

  revalidatePath("/kontroll");
  return { ok: true };
}
