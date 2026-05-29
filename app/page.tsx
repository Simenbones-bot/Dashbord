// Forside som viser status på oppsettet (M0).
// Dette er en server-komponent: koden kjører på serveren, ikke i nettleseren.

const BRING_GREEN = "#003D24";

/** Sjekker om vi får kontakt med Supabase-prosjektet. */
async function sjekkSupabase(): Promise<"mangler" | "tilkoblet" | "feil"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return "mangler";

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    return res.ok ? "tilkoblet" : "feil";
  } catch {
    return "feil";
  }
}

export default async function Home() {
  const status = await sjekkSupabase();

  const visning = {
    mangler: {
      farge: "#8A8780",
      tittel: "Venter på Supabase-nøkler",
      tekst:
        "Prosjektet kjører, men er ikke koblet til Supabase ennå. Legg inn nøklene (se .env.local.example), så lyser dette grønt.",
    },
    tilkoblet: {
      farge: "#00643A",
      tittel: "Tilkoblet Supabase",
      tekst: "Fundamentet er på plass. Klar for M1 — innlogging og masterdata.",
    },
    feil: {
      farge: "#C7261B",
      tittel: "Fikk ikke kontakt med Supabase",
      tekst:
        "Nøkler er satt, men tilkoblingen feilet. Dobbeltsjekk URL og anon-nøkkel.",
    },
  }[status];

  return (
    <main
      style={{ backgroundColor: "#F4F4F2", color: "#111110" }}
      className="flex flex-1 flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#8A8780" }}
        >
          Drift
        </p>
        <h1
          className="mb-6 text-2xl font-medium tracking-tight"
          style={{ color: BRING_GREEN }}
        >
          Driftssystem for varebilselskap
        </h1>

        <div className="flex items-start gap-3 rounded-xl border border-[#ECEAE5] p-4">
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: visning.farge }}
          />
          <div>
            <p className="font-semibold">{visning.tittel}</p>
            <p className="mt-1 text-sm" style={{ color: "#4A4A48" }}>
              {visning.tekst}
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs" style={{ color: "#8A8780" }}>
          M0 — oppsett av Next.js, TypeScript og Supabase.
        </p>
      </div>
    </main>
  );
}
