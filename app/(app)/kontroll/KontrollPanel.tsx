"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lukkeDag, gjenapneDag } from "./actions";

export default function KontrollPanel({
  dato,
  erLukket,
  lukketAv,
  lukketTid,
  notat,
}: {
  dato: string;
  erLukket: boolean;
  lukketAv: string | null;
  lukketTid: string | null;
  notat: string | null;
}) {
  const router = useRouter();
  const [notatTekst, setNotatTekst] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function lukk() {
    setLaster(true);
    setFeil(null);
    const res = await lukkeDag(dato, notatTekst || null);
    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    setNotatTekst("");
    router.refresh();
  }

  async function gjenapne() {
    setLaster(true);
    setFeil(null);
    const res = await gjenapneDag(dato);
    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className="mt-5 rounded-2xl p-5 shadow-sm"
      style={{
        backgroundColor: "var(--surface)",
        border: erLukket ? "1.5px solid var(--bring-green)" : "1.5px solid var(--border)",
      }}
    >
      {erLukket ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium"
              style={{ backgroundColor: "var(--green-soft)", color: "var(--bring-green-mid)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--bring-green-mid)" }}
              />
              Dagen er lukket
            </span>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              Lukket av <strong>{lukketAv ?? "ukjent"}</strong>
              {lukketTid ? ` kl. ${lukketTid}` : ""}.
            </p>
            {notat && (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
                Notat: {notat}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={gjenapne}
            disabled={laster}
            className="h-[42px] rounded-[10px] px-4 text-sm font-semibold disabled:opacity-60"
            style={{ border: "1.5px solid var(--border-input)", color: "var(--foreground)" }}
          >
            {laster ? "Åpner …" : "Gjenåpne dag"}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[14px] font-medium">Dagen er åpen</p>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            Kontroller planlagt vs. faktisk under, og lukk dagen når den er godkjent.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={notatTekst}
              onChange={(e) => setNotatTekst(e.target.value)}
              placeholder="Notat (valgfritt)"
              className="w-full px-3 py-2.5 text-[15px] outline-none sm:max-w-[320px]"
              style={{ border: "1.5px solid var(--border-input)", borderRadius: 10 }}
            />
            <button
              type="button"
              onClick={lukk}
              disabled={laster}
              className="h-[42px] shrink-0 rounded-[10px] px-5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--bring-green)" }}
            >
              {laster ? "Lukker …" : "Godkjenn og lukk dag"}
            </button>
          </div>
        </div>
      )}

      {feil && (
        <p
          className="mt-3 rounded-[10px] px-3 py-2.5 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          {feil}
        </p>
      )}
    </div>
  );
}
