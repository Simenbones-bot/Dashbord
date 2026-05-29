import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

// Beskyttet side. Foreløpig en plassholder – blir den ekte dagsoversikten i M4.
export default async function DagsoversiktPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ekstra sikkerhetssjekk på serveren (i tillegg til proxy.ts).
  if (!user) redirect("/login");

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center p-8"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-tertiary)" }}
        >
          Drift
        </p>
        <h1
          className="text-2xl font-medium tracking-tight"
          style={{ color: "var(--bring-green)" }}
        >
          Du er logget inn
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          Innlogget som <strong>{user.email}</strong>.
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Dette blir dagsoversikten senere (M4). Nå er innloggingen (M1.1) på
          plass.
        </p>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="h-11 rounded-[10px] px-5 text-sm font-semibold"
            style={{ border: "1.5px solid #1F1F1D", color: "#1F1F1D" }}
          >
            Logg ut
          </button>
        </form>
      </div>
    </main>
  );
}
