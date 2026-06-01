"use client";

import { useState } from "react";
import RuteSkjema, { type Valg } from "./RuteSkjema";

export type { Valg };

export default function NyRute({
  kunder,
  biler,
}: {
  kunder: Valg[];
  biler: Valg[];
}) {
  const [apen, setApen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setApen(true)}
        className="h-[42px] rounded-[10px] px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--bring-green)" }}
      >
        Ny rute
      </button>

      {apen && (
        <RuteSkjema
          onClose={() => setApen(false)}
          rute={null}
          kunder={kunder}
          biler={biler}
        />
      )}
    </>
  );
}
