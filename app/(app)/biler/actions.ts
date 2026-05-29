"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function tallEllerNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function tekstEllerNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export type OpprettResultat = { ok: true } | { ok: false; feil: string };

/** Oppretter en ny bil knyttet til den innloggede brukerens enhet. */
export async function opprettBil(
  formData: FormData,
): Promise<OpprettResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  // Finn brukerens enhet (RLS krever at bilen knyttes til en enhet du har tilgang til).
  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id")
    .eq("id", user.id)
    .single();

  if (!profile?.unit_id) {
    return { ok: false, feil: "Brukeren din er ikke koblet til en enhet." };
  }

  const reg = String(formData.get("reg_number") ?? "")
    .trim()
    .toUpperCase();
  const make = String(formData.get("make") ?? "");
  const model = String(formData.get("model") ?? "");

  if (!reg || !make || !model) {
    return { ok: false, feil: "Reg.nr, merke og modell må fylles ut." };
  }

  const { error } = await supabase.from("vehicle").insert({
    unit_id: profile.unit_id,
    reg_number: reg,
    make,
    model,
    model_year: tallEllerNull(formData.get("model_year")),
    status: String(formData.get("status") ?? "i_drift"),
    leasing_cost_monthly: tallEllerNull(formData.get("leasing_cost_monthly")),
    service_cost_yearly: tallEllerNull(formData.get("service_cost_yearly")),
    eu_control_date: tekstEllerNull(formData.get("eu_control_date")),
    next_service_date: tekstEllerNull(formData.get("next_service_date")),
  });

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/biler");
  return { ok: true };
}
