"use client";

import { useState } from "react";

/** Knapp pr. bil som viser QR-kode + kopierbar stemplingslenke i en modal. */
export default function StemplingQR({
  regNumber,
  link,
  qrSvg,
}: {
  regNumber: string;
  link: string;
  qrSvg: string;
}) {
  const [apen, setApen] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  async function kopier() {
    try {
      await navigator.clipboard.writeText(link);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setKopiert(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setApen(true)}
        className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium"
        style={{ border: "1px solid var(--border)", color: "var(--bring-green)" }}
      >
        QR / lenke
      </button>

      {apen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
            onClick={() => setApen(false)}
          />
          <div
            className="relative w-full max-w-[360px] rounded-2xl p-6 text-center shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2
                className="text-lg font-medium tracking-tight"
                style={{ fontFamily: "var(--font-dm-mono)" }}
              >
                {regNumber}
              </h2>
              <button
                type="button"
                onClick={() => setApen(false)}
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Lukk
              </button>
            </div>
            <p className="mb-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Heng denne i bilen. Sjåføren skanner for å stemple.
            </p>

            {/* QR-koden (SVG generert på server) */}
            <div
              className="mx-auto w-[200px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <div
              className="mt-4 truncate rounded-[8px] px-3 py-2 text-[12px]"
              style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}
              title={link}
            >
              {link}
            </div>
            <button
              type="button"
              onClick={kopier}
              className="mt-3 h-10 w-full rounded-[10px] text-[14px] font-semibold text-white"
              style={{ backgroundColor: "var(--bring-green)" }}
            >
              {kopiert ? "Kopiert!" : "Kopier lenke"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
