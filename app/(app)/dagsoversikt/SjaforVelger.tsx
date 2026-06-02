"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { settSjaforPaVakt } from "./actions";

export type SjaforValg = { id: string; navn: string };

// Initialer fra navn ("Anders Vik" → "AV").
function initialer(navn: string): string {
  const deler = navn.trim().split(/\s+/);
  return ((deler[0]?.[0] ?? "") + (deler[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Nedtrekksmeny for sjåfør, vist inne i en vakt-boks i dagsoversikten.
 * Lagrer valget med en gang (server action) og oppdaterer siden.
 */
export default function SjaforVelger({
  shiftId,
  valgtId,
  navn,
  sjaforer,
  accent,
}: {
  shiftId: string;
  valgtId: string;
  navn: string | null;
  sjaforer: SjaforValg[];
  accent: string;
}) {
  const router = useRouter();
  const [verdi, setVerdi] = useState(valgtId);
  const [laster, setLaster] = useState(false);

  async function endre(ny: string) {
    const forrige = verdi;
    setVerdi(ny);
    setLaster(true);
    const res = await settSjaforPaVakt(shiftId, ny);
    setLaster(false);
    if (!res.ok) {
      setVerdi(forrige); // rull tilbake ved feil
      alert(res.feil);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {navn && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {initialer(navn)}
        </span>
      )}
      <select
        aria-label="Velg sjåfør"
        value={verdi}
        disabled={laster}
        onChange={(e) => endre(e.target.value)}
        className="min-w-0 max-w-full truncate rounded-[6px] bg-transparent py-0.5 pl-1 pr-4 text-[11.5px] outline-none disabled:opacity-50"
        style={{
          border: "1px solid var(--border-input)",
          color: navn ? "var(--text-secondary)" : "var(--text-tertiary)",
          cursor: laster ? "wait" : "pointer",
        }}
      >
        <option value="">Velg sjåfør …</option>
        {sjaforer.map((s) => (
          <option key={s.id} value={s.id}>
            {s.navn}
          </option>
        ))}
      </select>
    </div>
  );
}
