import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./Sidebar";

const ROLLE_TEKST: Record<number, string> = {
  1: "Transportleder",
  2: "Regionsleder",
  3: "Executive Manager",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Hent profil + tilknyttet enhet for visning i sidemenyen.
  const { data: profile } = await supabase
    .from("profile")
    .select("full_name, role, unit:unit_id (name, code)")
    .eq("id", user.id)
    .single();

  // Supabase typer en til-en-relasjon som liste; hent forste element trygt.
  const unitRel = profile?.unit as
    | { name: string; code: string }
    | { name: string; code: string }[]
    | null
    | undefined;
  const unit = Array.isArray(unitRel) ? (unitRel[0] ?? null) : (unitRel ?? null);

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar
        unitName={unit?.name ?? "Ingen enhet"}
        unitCode={unit?.code ?? "—"}
        userName={profile?.full_name ?? user.email ?? "Bruker"}
        roleLabel={ROLLE_TEKST[profile?.role ?? 1] ?? "Bruker"}
      />
      <main
        className="flex-1"
        style={{ backgroundColor: "var(--background)" }}
      >
        {children}
      </main>
    </div>
  );
}
