"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type StempleResultat = { ok: true } | { ok: false; feil: string };

function tekstEllerNull(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function iDagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Admin = ReturnType<typeof createAdminClient>;

// Slår opp bilen ut fra koden i lenken.
async function bilFraToken(admin: Admin, token: string) {
  const { data } = await admin
    .from("vehicle")
    .select("id, unit_id")
    .eq("stamp_token", token)
    .maybeSingle();
  return data;
}

// Bekrefter at vakten finnes, hører til denne bilen OG er i dag.
async function gyldigVakt(admin: Admin, shiftId: string, vehicleId: string) {
  const { data } = await admin
    .from("shift")
    .select("id, unit_id, vehicle_id, date")
    .eq("id", shiftId)
    .maybeSingle();
  if (!data) return null;
  if (data.vehicle_id !== vehicleId) return null;
  if (data.date !== iDagOslo()) return null;
  return data;
}

/** Stempler INN på en vakt knyttet til bilens kode. */
export async function stempleInn(
  token: string,
  shiftId: string,
  driverId: string,
  comment: string | null,
): Promise<StempleResultat> {
  const admin = createAdminClient();

  const bil = await bilFraToken(admin, token);
  if (!bil) return { ok: false, feil: "Ugyldig kode." };
  if (!driverId) return { ok: false, feil: "Velg sjåfør først." };

  const vakt = await gyldigVakt(admin, shiftId, bil.id);
  if (!vakt) return { ok: false, feil: "Fant ikke vakten for denne bilen i dag." };

  // Sjåføren må tilhøre samme enhet som bilen.
  const { data: sjafor } = await admin
    .from("driver")
    .select("id, unit_id")
    .eq("id", driverId)
    .maybeSingle();
  if (!sjafor || sjafor.unit_id !== bil.unit_id) {
    return { ok: false, feil: "Ugyldig sjåfør." };
  }

  const { error } = await admin.from("time_entry").upsert(
    {
      shift_id: shiftId,
      unit_id: vakt.unit_id,
      driver_id: driverId,
      check_in: new Date().toISOString(),
      comment: tekstEllerNull(comment),
    },
    { onConflict: "shift_id" },
  );
  if (error) return { ok: false, feil: error.message };

  revalidatePath(`/stemple/${token}`);
  return { ok: true };
}

/** Stempler UT på en vakt (må være stemplet inn først). */
export async function stempleUt(
  token: string,
  shiftId: string,
  comment: string | null,
): Promise<StempleResultat> {
  const admin = createAdminClient();

  const bil = await bilFraToken(admin, token);
  if (!bil) return { ok: false, feil: "Ugyldig kode." };

  const vakt = await gyldigVakt(admin, shiftId, bil.id);
  if (!vakt) return { ok: false, feil: "Fant ikke vakten for denne bilen i dag." };

  const { data: eksisterende } = await admin
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

  const { error } = await admin
    .from("time_entry")
    .update(oppdatering)
    .eq("id", eksisterende.id);
  if (error) return { ok: false, feil: error.message };

  revalidatePath(`/stemple/${token}`);
  return { ok: true };
}
