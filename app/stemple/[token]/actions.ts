"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type StempleResultat = { ok: true } | { ok: false; feil: string };

// Navnet pa den private lagringsbotta (se 0008_bilsjekk_storage.sql).
const BILDE_BUCKET = "bilsjekk-bilder";

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

// Slar opp bilen ut fra koden i lenken.
async function bilFraToken(admin: Admin, token: string) {
  const { data } = await admin
    .from("vehicle")
    .select("id, unit_id")
    .eq("stamp_token", token)
    .maybeSingle();
  return data;
}

// Bekrefter at vakten finnes, horer til denne bilen OG er i dag.
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

// Laster opp ett bilde til den private botta og returnerer lagringsstien.
async function lastOppBilde(
  admin: Admin,
  unitId: string,
  shiftId: string,
  checkId: string,
  fil: File,
): Promise<string | null> {
  const sti = `${unitId}/${shiftId}/${checkId}/${crypto.randomUUID()}.jpg`;
  const data = await fil.arrayBuffer();
  const { error } = await admin.storage.from(BILDE_BUCKET).upload(sti, data, {
    contentType: fil.type || "image/jpeg",
    upsert: false,
  });
  if (error) return null;
  return sti;
}

/**
 * Stempler INN pa en vakt + lagrer bilsjekk (ok/avvik, kommentar og bilder).
 * Tar imot et FormData-objekt fordi det inneholder bildefiler.
 */
export async function stempleInn(formData: FormData): Promise<StempleResultat> {
  const admin = createAdminClient();

  const token = String(formData.get("token") ?? "");
  const shiftId = String(formData.get("shiftId") ?? "");
  const driverId = String(formData.get("driverId") ?? "");
  const comment = tekstEllerNull(formData.get("comment") as string | null);
  const sjekkStatus =
    formData.get("sjekkStatus") === "avvik" ? "avvik" : "ok";
  const bilder = formData
    .getAll("bilder")
    .filter((b): b is File => b instanceof File && b.size > 0);

  const bil = await bilFraToken(admin, token);
  if (!bil) return { ok: false, feil: "Ugyldig kode." };
  if (!driverId) return { ok: false, feil: "Velg sjafor forst." };
  if (sjekkStatus === "avvik" && !comment) {
    return { ok: false, feil: "Beskriv avviket i kommentarfeltet." };
  }

  const vakt = await gyldigVakt(admin, shiftId, bil.id);
  if (!vakt) return { ok: false, feil: "Fant ikke vakten for denne bilen i dag." };

  // Sjaforen ma tilhore samme enhet som bilen.
  const { data: sjafor } = await admin
    .from("driver")
    .select("id, unit_id")
    .eq("id", driverId)
    .maybeSingle();
  if (!sjafor || sjafor.unit_id !== bil.unit_id) {
    return { ok: false, feil: "Ugyldig sjafor." };
  }

  // 1) Stemple inn (en rad pr. vakt).
  const { data: stempling, error: stemplingFeil } = await admin
    .from("time_entry")
    .upsert(
      {
        shift_id: shiftId,
        unit_id: vakt.unit_id,
        driver_id: driverId,
        check_in: new Date().toISOString(),
        comment,
      },
      { onConflict: "shift_id" },
    )
    .select("id")
    .single();
  if (stemplingFeil || !stempling) {
    return { ok: false, feil: stemplingFeil?.message ?? "Klarte ikke a stemple inn." };
  }

  // 2) Lagre bilsjekken knyttet til stemplingen.
  const { data: sjekk, error: sjekkFeil } = await admin
    .from("vehicle_check")
    .insert({
      unit_id: vakt.unit_id,
      shift_id: shiftId,
      time_entry_id: stempling.id,
      driver_id: driverId,
      status: sjekkStatus,
      comment,
    })
    .select("id")
    .single();
  if (sjekkFeil || !sjekk) {
    return { ok: false, feil: sjekkFeil?.message ?? "Klarte ikke a lagre bilsjekken." };
  }

  // 3) Last opp bildene og koble dem til bilsjekken.
  for (const fil of bilder) {
    const sti = await lastOppBilde(admin, vakt.unit_id, shiftId, sjekk.id, fil);
    if (!sti) {
      return { ok: false, feil: "Klarte ikke a laste opp et av bildene. Prov igjen." };
    }
    const { error: bildeFeil } = await admin.from("photo").insert({
      unit_id: vakt.unit_id,
      vehicle_check_id: sjekk.id,
      storage_path: sti,
    });
    if (bildeFeil) return { ok: false, feil: bildeFeil.message };
  }

  revalidatePath(`/stemple/${token}`);
  return { ok: true };
}

/** Stempler UT pa en vakt (ma vaere stemplet inn forst). */
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
    return { ok: false, feil: "Du ma stemple inn for du stempler ut." };
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
