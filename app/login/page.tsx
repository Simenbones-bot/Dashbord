"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [visPassord, setVisPassord] = useState(false);
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function loggInn(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    setLaster(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: epost,
      password: passord,
    });

    if (error) {
      // Norsk, brukervennlig melding uavhengig av Supabase sin engelske tekst.
      setFeil("Feil e-post eller passord. Prøv igjen.");
      setLaster(false);
      return;
    }

    // Innlogget: gå til dagsoversikten og oppdater server-tilstanden.
    router.push("/dagsoversikt");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Venstre: merkepanel (skjult på mobil) */}
      <div
        className="relative hidden flex-col justify-between p-14 lg:flex"
        style={{ backgroundColor: "var(--bring-green)", color: "#ffffff" }}
      >
        <div className="text-lg font-semibold tracking-tight">Drift</div>

        <div className="max-w-md">
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--bring-mint)" }}
          >
            Driftssystem for varebil
          </p>
          <h1 className="text-4xl font-medium leading-tight tracking-tight">
            Vi gjør hverdagen enklere og verden mindre.
          </h1>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Planlegg ruter, følg dagens kjøring i sanntid, og kontroller
            arbeidstid – alt på ett sted.
          </p>
        </div>

        {/* Merkestripe rød → hvit → grønn */}
        <div
          className="h-1.5 w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#E32D22,#FFFFFF 50%,#56B529)",
          }}
        />
      </div>

      {/* Høyre: innloggingsskjema */}
      <div
        className="flex items-center justify-center p-8"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="w-full max-w-[420px]">
          {/* Logo synlig på mobil der merkepanelet er skjult */}
          <div
            className="mb-8 text-lg font-semibold tracking-tight lg:hidden"
            style={{ color: "var(--bring-green)" }}
          >
            Drift
          </div>

          <h2
            className="text-2xl font-medium tracking-tight"
            style={{ color: "var(--bring-green)" }}
          >
            Logg inn
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Bruk e-posten og passordet du har fått tildelt.
          </p>

          <form onSubmit={loggInn} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="epost"
                className="mb-1.5 block text-sm font-medium"
              >
                E-post
              </label>
              <input
                id="epost"
                type="email"
                required
                autoComplete="email"
                value={epost}
                onChange={(e) => setEpost(e.target.value)}
                className="w-full rounded-[10px] px-3.5 py-3 text-[15px] outline-none focus:ring-2"
                style={{
                  border: "1.5px solid var(--border-input)",
                  // @ts-expect-error CSS-variabel for fokusring
                  "--tw-ring-color": "var(--bring-green)",
                }}
                placeholder="navn@bring.no"
              />
            </div>

            <div>
              <label
                htmlFor="passord"
                className="mb-1.5 block text-sm font-medium"
              >
                Passord
              </label>
              <div className="relative">
                <input
                  id="passord"
                  type={visPassord ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={passord}
                  onChange={(e) => setPassord(e.target.value)}
                  className="w-full rounded-[10px] px-3.5 py-3 pr-16 text-[15px] outline-none focus:ring-2"
                  style={{
                    border: "1.5px solid var(--border-input)",
                    // @ts-expect-error CSS-variabel for fokusring
                    "--tw-ring-color": "var(--bring-green)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setVisPassord((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {visPassord ? "Skjul" : "Vis"}
                </button>
              </div>
            </div>

            {feil && (
              <p
                className="rounded-[10px] px-3.5 py-2.5 text-sm"
                style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
              >
                {feil}
              </p>
            )}

            <button
              type="submit"
              disabled={laster}
              className="h-[52px] w-full rounded-[10px] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--bring-green)" }}
            >
              {laster ? "Logger inn …" : "Logg inn"}
            </button>
          </form>

          <p
            className="mt-8 text-center text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            Sikret med to-faktor · EU-region · GDPR
          </p>
        </div>
      </div>
    </div>
  );
}
