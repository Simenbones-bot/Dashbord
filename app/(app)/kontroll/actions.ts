"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type KontrollResultat = { ok: true } | { ok: false; feil: string };

// Enkel datovalidering: forventer "YYYY-MM-DD".
function gyldigDato(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Henter innlogget bruker + enhet + navn (brukes til revisjonsloggen).
async function brukerOgEnhet() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, feil: "Du er ikke innlogget." as const };

  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.unit_id) {
    return { supabase, feil: "Brukeren din er ikke koblet til en enhet." as const };
  }
  return {
    supabase,
    user,
    unitId: profile.unit_id as string,
    fullName: (profile.full_name as string | null) ?? user.email ?? "Ukjent",
  };
}

/** Lukker dagen for lederens enhet og logger hvem/naar. */
export async function lukkeDag(
  date: string,
  note: string | null,
): Promise<KontrollResultat> {
  if (!gyldigDato(date)) return { ok: false, feil: "Ugyldig dato." };

  const ctx = await brukerOgEnhet();
  if (ctx.feil) return { ok: false, feil: ctx.feil };
  const { supabase, user, unitId, fullName } = ctx;

  // Opprett eller oppdater kontroll-raden (unik pr. enhet + dato).
  const { error } = await supabase.from("day_closing").upsert(
    {
      unit_id: unitId,
      date,
      status: "lukket",
      closed_by: user!.id,
      closed_by_name: fullName,
      closed_at: new Date().toISOString(),
      note: note?.trim() ? note.trim() : null,
    },
    { onConflict: "unit_id,date" },
  );
  if (error) return { ok: false, feil: error.message };

  // Skriv revisjonslogg (egen rad pr. handling).
  await supabase.from("day_closing_log").insert({
    unit_id: unitId,
    date,
    action: "lukket",
    actor_id: user!.id,
    actor_name: fullName,
  });

  revalidatePath("/kontroll");
  return { ok: true };
}

/** Aapner en lukket dag igjen (f.eks. ved feil) og logger handlingen. */
export async function gjenapneDag(date: string): Promise<KontrollResultat> {
  if (!gyldigDato(date)) return { ok: false, feil: "Ugyldig dato." };

  const ctx = await brukerOgEnhet();
  if (ctx.feil) return { ok: false, feil: ctx.feil };
  const { supabase, user, unitId, fullName } = ctx;

  const { error } = await supabase
    .from("day_closing")
    .update({
      status: "apen",
      closed_by: null,
      closed_by_name: null,
      closed_at: null,
    })
    .eq("unit_id", unitId)
    .eq("date", date);
  if (error) return { ok: false, feil: error.message };

  await supabase.from("day_closing_log").insert({
    unit_id: unitId,
    date,
    action: "gjenapnet",
    actor_id: user!.id,
    actor_name: fullName,
  });

  revalidatePath("/kontroll");
  return { ok: true };
}
