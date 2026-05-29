"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { opprettSjafor } from "./actions";

const FORERKORT = ["B", "C1", "C", "CE"];

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

/** Lager forslag til e-post: "ola.nordmann@bring.no" ut fra navnet. */
function epostForslag(navn: string): string {
  const ren = navn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z.]/g, "");
  return ren ? `${ren}@bring.no` : "navn@bring.no";
}

export default function NySjafor() {
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [navn, setNavn] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  function lukk() {
    setApen(false);
    setNavn("");
    setFeil(null);
  }

  async function lagre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);

    const fd = new FormData(e.currentTarget);
    const res = await opprettSjafor(fd);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    lukk();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setApen(true)}
        className="h-[42px] rounded-[10px] px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--bring-green)" }}
      >
        Ny sjåfør
      </button>

      {apen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
            onClick={lukk}
          />
          <div
            className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto p-7 shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className="text-xl font-medium tracking-tight"
                style={{ color: "var(--bring-green)" }}
              >
                Ny sjåfør
              </h2>
              <button
                type="button"
                onClick={lukk}
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Lukk
              </button>
            </div>

            <form onSubmit={lagre} className="space-y-4">
              <Felt label="Navn">
                <input
                  name="full_name"
                  required
                  value={navn}
                  onChange={(e) => setNavn(e.target.value)}
                  placeholder="Ola Nordmann"
                  className="w-full px-3 py-2.5 text-[15px] outline-none"
                  style={inputStil}
                />
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Telefon">
                  <input
                    name="phone"
                    type="tel"
                    placeholder="900 00 000"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Førerkort">
                  <select
                    name="license_class"
                    defaultValue="B"
                    className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  >
                    {FORERKORT.map((k) => (
                      <option key={k} value={k}>
                        Klasse {k}
                      </option>
                    ))}
                  </select>
                </Felt>
              </div>

              <Felt label="E-post">
                <input
                  name="email"
                  type="email"
                  placeholder={epostForslag(navn)}
                  className="w-full px-3 py-2.5 text-[15px] outline-none"
                  style={inputStil}
                />
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Ansatt år">
                  <input
                    name="employed_year"
                    type="number"
                    min="1990"
                    max="2100"
                    placeholder="2021"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Status">
                  <select
                    name="status"
                    defaultValue="aktiv"
                    className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  >
                    <option value="aktiv">Aktiv</option>
                    <option value="inaktiv">Inaktiv</option>
                  </select>
                </Felt>
              </div>

              {feil && (
                <p
                  className="rounded-[10px] px-3 py-2.5 text-sm"
                  style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
                >
                  {feil}
                </p>
              )}

              <button
                type="submit"
                disabled={laster}
                className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--bring-green)" }}
              >
                {laster ? "Lagrer …" : "Lagre sjåfør"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Felt({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
