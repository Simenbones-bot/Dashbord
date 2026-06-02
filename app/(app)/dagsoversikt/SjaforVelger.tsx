"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { settSjaforPaVakt, settFastSjaforPaRute, type SjaforFelt } from "./actions";

export type SjaforValg = { id: string; navn: string };

// Initialer fra navn ("Erna Solberg" → "ES").
function initialer(navn: string): string {
  const deler = navn.trim().split(/\s+/);
  return ((deler[0]?.[0] ?? "") + (deler[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Søkbar sjåfør-velger i en vakt-boks. Skriv navn eller initialer for å
 * filtrere. Klikk et navn for å sette sjåfør på dagens vakt, eller "Fast" for
 * å sette sjåføren fast på ruten fra og med i morgen.
 *
 * Selve panelet rendres med en portal til <body> slik at det ikke klippes av
 * den lille (overflow-hidden) vakt-boksen.
 */
export default function SjaforVelger({
  shiftId,
  valgtId,
  navn,
  sjaforer,
  accent,
  fastDriverId,
  felt = "driver_id",
  etikett,
  placeholder = "Velg sjåfør …",
}: {
  shiftId: string;
  valgtId: string;
  navn: string | null;
  sjaforer: SjaforValg[];
  accent: string;
  fastDriverId: string | null;
  felt?: SjaforFelt;
  etikett?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const [laster, setLaster] = useState(false);
  const [verdi, setVerdi] = useState(valgtId);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  // Navn på valgt sjåfør (fra lista, ev. fallback til server-navnet).
  const valgtNavn = verdi
    ? sjaforer.find((s) => s.id === verdi)?.navn ?? navn
    : null;
  const erFast = verdi !== "" && verdi === fastDriverId;

  function apne() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const bredde = Math.min(Math.max(r.width, 220), 280);
      const left = Math.min(r.left, window.innerWidth - bredde - 8);
      setPos({ top: r.bottom + 4, left: Math.max(8, left), width: bredde });
    }
    setSok("");
    setApen(true);
  }

  // Lukk på Escape.
  useEffect(() => {
    if (!apen) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setApen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [apen]);

  const q = sok.trim().toLowerCase();
  const treff = sjaforer.filter((s) => {
    if (!q) return true;
    if (s.navn.toLowerCase().includes(q)) return true;
    return initialer(s.navn).toLowerCase().includes(q.replace(/\s+/g, ""));
  });

  async function velg(id: string) {
    setApen(false);
    const forrige = verdi;
    setVerdi(id);
    setLaster(true);
    const res = await settSjaforPaVakt(shiftId, id, felt);
    setLaster(false);
    if (!res.ok) {
      setVerdi(forrige); // rull tilbake ved feil
      alert(res.feil);
      return;
    }
    router.refresh();
  }

  async function settFast(id: string) {
    setApen(false);
    setLaster(true);
    const res = await settFastSjaforPaRute(shiftId, id, felt);
    setLaster(false);
    if (!res.ok) {
      alert(res.feil);
      return;
    }
    setVerdi(id);
    router.refresh();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Velg sjåfør"
        disabled={laster}
        onClick={apne}
        className="flex min-w-0 items-center gap-1.5 rounded-[6px] py-0.5 pl-1 pr-1.5 text-[11.5px] outline-none disabled:opacity-50"
        style={{
          border: "1px solid var(--border-input)",
          color: valgtNavn ? "var(--text-secondary)" : "var(--text-tertiary)",
          cursor: laster ? "wait" : "pointer",
          maxWidth: "100%",
        }}
      >
        {etikett && (
          <span
            className="shrink-0 text-[9px] font-semibold uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            {etikett}
          </span>
        )}
        {valgtNavn && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {initialer(valgtNavn)}
          </span>
        )}
        <span className="min-w-0 truncate">{valgtNavn ?? placeholder}</span>
        {erFast && (
          <span className="shrink-0" style={{ color: accent }} title="Fast sjåfør på ruten">
            ★
          </span>
        )}
        <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
          ▾
        </span>
      </button>

      {apen &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Bakteppe som fanger klikk utenfor */}
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setApen(false)}
            />
            <div
              className="fixed z-[61] overflow-hidden rounded-[10px] shadow-xl"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="p-1.5">
                <input
                  autoFocus
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  placeholder="Søk navn eller initialer …"
                  className="w-full rounded-[7px] px-2.5 py-2 text-[13px] outline-none"
                  style={{ border: "1.5px solid var(--border-input)" }}
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto pb-1">
                {treff.length === 0 && (
                  <p
                    className="px-3 py-2 text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Ingen treff.
                  </p>
                )}
                {treff.map((s) => {
                  const valgtNaa = s.id === verdi;
                  const fastNaa = s.id === fastDriverId;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-1 px-1.5"
                      style={
                        valgtNaa ? { backgroundColor: "var(--green-soft)" } : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => velg(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-[7px] px-1.5 py-2 text-left text-[13px]"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {initialer(s.navn)}
                        </span>
                        <span className="min-w-0 truncate">{s.navn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => settFast(s.id)}
                        title="Sett fast på ruten fra og med i morgen"
                        className="shrink-0 rounded-[6px] px-2 py-1 text-[11px] font-semibold"
                        style={
                          fastNaa
                            ? { backgroundColor: accent, color: "#fff" }
                            : {
                                border: "1.5px solid var(--border-input)",
                                color: "var(--text-secondary)",
                              }
                        }
                      >
                        {fastNaa ? "★ Fast" : "Fast"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {verdi !== "" && (
                <button
                  type="button"
                  onClick={() => velg("")}
                  className="block w-full border-t px-3 py-2 text-left text-[12.5px]"
                  style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                >
                  Fjern sjåfør
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
