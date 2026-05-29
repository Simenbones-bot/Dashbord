"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function tekstEllerNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export type OpprettResultat = { ok: true } | { ok: false; feil: string };

/** Oppretter en ny kunde knyttet til den innloggede brukerens enhet. */
export async function opprettKunde(
  formData: FormData,
): Promise<OpprettResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du er ikke innlogget." };

  // Finn brukerens enhet (RLS krever at kunden knyttes til en enhet du har tilgang til).
  const { data: profile } = await supabase
    .from("profile")
    .select("unit_id")
    .eq("id", user.id)
    .single();

  if (!profile?.unit_id) {
    return { ok: false, feil: "Brukeren din er ikke koblet til en enhet." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, feil: "Navn må fylles ut." };
  }

  const { error } = await supabase.from("customer").insert({
    unit_id: profile.unit_id,
    name,
    customer_number: tekstEllerNull(formData.get("customer_number")),
    parent_customer_id: tekstEllerNull(formData.get("parent_customer_id")),
  });

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/kunder");
  return { ok: true };
}
