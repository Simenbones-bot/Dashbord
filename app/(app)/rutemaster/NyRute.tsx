"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { opprettRute } from "./actions";

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

export type Valg = { id: string; navn: string };

// ISO-ukedager: 1 = mandag … 7 = søndag.
const UKEDAGER: { nr: number; kort: string }[] = [
  { nr: 1, kort: "Man" },
  { nr: 2, kort: "Tir" },
  { nr: 3, kort: "Ons" },
  { nr: 4, kort: "Tor" },
  { nr: 5, kort: "Fre" },
  { nr: 6, kort: "Lør" },
  { nr: 7, kort: "Søn" },
];

export default function NyRute({
  kunder,
  biler,
  sjaforer,
}: {
  kunder: Valg[];
  biler: Valg[];
  sjaforer: Valg[];
}) {
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [dager, setDager] = useState<number[]>([1, 2, 3, 4, 5]); // man–fre

  function veksleDag(nr: number) {
    setDager((d) =>
      d.includes(nr) ? d.filter((x) => x !== nr) : [...d, nr].sort(),
    );
  }

  function lukk() {
    setApen(false);
    setFeil(null);
    setDager([1, 2, 3, 4, 5]);
  }

  async function lagre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);

    const fd = new FormData(e.currentTarget);
    const res = await opprettRute(fd);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    lukk();
    router.refresh(); // oppdater tabellen med den nye ruten
  }

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
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Bakteppe */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
            onClick={lukk}
          />
          {/* Skuff */}
          <div
            className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto p-7 shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className="text-xl font-medium tracking-tight"
                style={{ color: "var(--bring-green)" }}
              >
                Ny rute
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
              <div className="grid grid-cols-2 gap-3">
                <Felt label="Rutenavn">
                  <input
                    name="name"
                    required
                    placeholder="F.eks. Storo morgen"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Rutenummer">
                  <input
                    name="route_number"
                    placeholder="Valgfritt"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
              </div>

              <Felt label="Kunde">
                <Velg navn="customer_id" valg={kunder} />
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Bil">
                  <Velg navn="vehicle_id" valg={biler} />
                </Felt>
                <Felt label="Sjåfør">
                  <Velg navn="driver_id" valg={sjaforer} />
                </Felt>
              </div>

              <Felt label="Sidemann (valgfritt)">
                <Velg navn="co_driver_id" valg={sjaforer} />
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Starttid">
                  <input
                    name="start_time"
                    type="time"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Sluttid">
                  <input
                    name="end_time"
                    type="time"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
              </div>

              <Felt label="Kjøredager">
                <div className="flex flex-wrap gap-1.5">
                  {UKEDAGER.map((u) => {
                    const valgt = dager.includes(u.nr);
                    return (
                      <button
                        key={u.nr}
                        type="button"
                        onClick={() => veksleDag(u.nr)}
                        className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium"
                        style={
                          valgt
                            ? {
                                backgroundColor: "var(--bring-green)",
                                color: "#fff",
                              }
                            : {
                                border: "1.5px solid var(--border-input)",
                                color: "var(--text-secondary)",
                              }
                        }
                      >
                        {u.kort}
                      </button>
                    );
                  })}
                </div>
                {/* Sender valgte dager til server-action-en. */}
                {dager.map((d) => (
                  <input key={d} type="hidden" name="weekdays" value={d} />
                ))}
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Tur (km)">
                  <input
                    name="distance_km"
                    type="number"
                    min="0"
                    placeholder="120"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Inntekt/time">
                  <input
                    name="revenue_per_hour"
                    type="number"
                    min="0"
                    placeholder="850"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
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
                {laster ? "Lagrer …" : "Lagre rute"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Gjenbrukbart nedtrekk: "Velg …" + listen, sender tom verdi = ingen. */
function Velg({ navn, valg }: { navn: string; valg: Valg[] }) {
  return (
    <select
      name={navn}
      defaultValue=""
      className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
      style={inputStil}
    >
      <option value="">Velg …</option>
      {valg.map((v) => (
        <option key={v.id} value={v.id}>
          {v.navn}
        </option>
      ))}
    </select>
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
