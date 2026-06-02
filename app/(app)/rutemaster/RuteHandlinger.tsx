"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RuteSkjema, { type RuteData, type Valg } from "./RuteSkjema";
import { slettRute } from "./actions";

export default function RuteHandlinger({
  rute,
  kunder,
  biler,
}: {
  rute: RuteData;
  kunder: Valg[];
  biler: Valg[];
}) {
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [sletter, setSletter] = useState(false);

  async function slett() {
    const ok = window.confirm(
      `Slette ruten «${rute.name}»? Dette fjerner også genererte vakter for ruten.`,
    );
    if (!ok) return;
    setSletter(true);
    const res = await slettRute(rute.id);
    setSletter(false);
    if (!res.ok) {
      window.alert("Kunne ikke slette: " + res.feil);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => setApen(true)}
        className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium"
        style={{ border: "1.5px solid var(--border-input)", color: "var(--text-secondary)" }}
      >
        Rediger
      </button>
      <button
        type="button"
        onClick={slett}
        disabled={sletter}
        className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
        style={{ border: "1.5px solid var(--danger)", color: "var(--danger)" }}
      >
        {sletter ? "Sletter …" : "Slett"}
      </button>

      {apen && (
        <RuteSkjema
          onClose={() => setApen(false)}
          rute={rute}
          kunder={kunder}
          biler={biler}
        />
      )}
    </div>
  );
}
