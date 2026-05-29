import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

// Beskyttet side. Foreløpig en plassholder – blir den ekte dagsoversikten i M4.
export default async function DagsoversiktPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="px-[38px] py-[30px]">
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-tertiary)" }}
      >
        Drift
      </p>
      <h1
        className="mt-1 text-[32px] font-medium tracking-tight"
        style={{ color: "var(--bring-green)" }}
      >
        Dagsoversikt
      </h1>

      <div
        className="mt-6 max-w-md rounded-2xl p-6 shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Innlogget som <strong>{user?.email}</strong>.
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Den ekte dagsoversikten med fargestatus bygges i M4. Gå til{" "}
          <strong>Biler</strong> i menyen for å legge inn biler.
        </p>

        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="h-11 rounded-[10px] px-5 text-sm font-semibold"
            style={{ border: "1.5px solid #1F1F1D", color: "#1F1F1D" }}
          >
            Logg ut
          </button>
        </form>
      </div>
    </div>
  );
}
