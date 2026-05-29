"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function tallEllerNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function tekstEllerNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export type OpprettResultat = { ok: true } | { ok: false; feil: string };

/** Oppretter en ny sjafor knyttet til den innloggede brukerens enhet. */
export async function opprettSjafor(
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

  const navn = String(formData.get("full_name") ?? "").trim();
  if (!navn) return { ok: false, feil: "Navn må fylles ut." };

  const { error } = await supabase.from("driver").insert({
    unit_id: profile.unit_id,
    full_name: navn,
    phone: tekstEllerNull(formData.get("phone")),
    email: tekstEllerNull(formData.get("email")),
    license_class: tekstEllerNull(formData.get("license_class")),
    employed_year: tallEllerNull(formData.get("employed_year")),
    status: String(formData.get("status") ?? "aktiv"),
  });

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/sjaforer");
  return { ok: true };
}
