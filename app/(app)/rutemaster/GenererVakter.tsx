"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { genererVakter } from "./actions";

export default function GenererVakter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offset = Math.trunc(Number(searchParams.get("uke") ?? 0)) || 0;
  const [laster, setLaster] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  async function kjor() {
    setLaster(true);
    setMelding(null);
    setFeil(null);

    const res = await genererVakter(offset);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    if (res.antall === 0) {
      setMelding("Ingen nye vakter – alt var allerede generert.");
    } else {
      setMelding(`Lagde ${res.antall} nye vakter for uken.`);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={kjor}
        disabled={laster}
        className="h-[42px] rounded-[10px] px-4 text-sm font-semibold disabled:opacity-60"
        style={{
          border: "1.5px solid var(--bring-green)",
          color: "var(--bring-green)",
        }}
      >
        {laster ? "Genererer …" : "Generer vakter for uken"}
      </button>
      {melding && (
        <span className="text-sm" style={{ color: "var(--bring-green-mid)" }}>
          {melding}
        </span>
      )}
      {feil && (
        <span
          className="rounded-[10px] px-3 py-1.5 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          {feil}
        </span>
      )}
    </div>
  );
}
