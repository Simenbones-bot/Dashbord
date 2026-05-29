"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MERKER, STATUS_VALG } from "./makes";
import { opprettBil } from "./actions";

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

export default function NyBil() {
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [merke, setMerke] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const merker = Object.keys(MERKER);
  const modeller = merke ? MERKER[merke] : [];

  function lukk() {
    setApen(false);
    setMerke("");
    setFeil(null);
  }

  async function lagre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);

    const fd = new FormData(e.currentTarget);
    const res = await opprettBil(fd);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    lukk();
    router.refresh(); // oppdater tabellen med den nye bilen
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setApen(true)}
        className="h-[42px] rounded-[10px] px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--bring-green)" }}
      >
        Ny bil
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
                Ny bil
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
              <Felt label="Registreringsnummer">
                <input
                  name="reg_number"
                  required
                  placeholder="EK 12345"
                  className="w-full px-3 py-2.5 text-[15px] uppercase outline-none"
                  style={inputStil}
                />
              </Felt>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Merke">
                  <select
                    name="make"
                    required
                    value={merke}
                    onChange={(e) => setMerke(e.target.value)}
                    className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  >
                    <option value="">Velg …</option>
                    {merker.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Felt>
                <Felt label="Modell">
                  <select
                    name="model"
                    required
                    disabled={!merke}
                    className="w-full bg-white px-3 py-2.5 text-[15px] outline-none disabled:opacity-50"
                    style={inputStil}
                  >
                    <option value="">{merke ? "Velg …" : "Velg merke først"}</option>
                    {modeller.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Felt>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Årsmodell">
                  <input
                    name="model_year"
                    type="number"
                    min="1990"
                    max="2100"
                    placeholder="2023"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Status">
                  <select
                    name="status"
                    defaultValue="i_drift"
                    className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  >
                    {STATUS_VALG.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Felt>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="Leasing pr. mnd (kr)">
                  <input
                    name="leasing_cost_monthly"
                    type="number"
                    min="0"
                    placeholder="4500"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Servicekost pr. år (kr)">
                  <input
                    name="service_cost_yearly"
                    type="number"
                    min="0"
                    placeholder="12000"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Felt label="EU-kontroll">
                  <input
                    name="eu_control_date"
                    type="date"
                    className="w-full px-3 py-2.5 text-[15px] outline-none"
                    style={inputStil}
                  />
                </Felt>
                <Felt label="Neste service">
                  <input
                    name="next_service_date"
                    type="date"
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
                {laster ? "Lagrer …" : "Lagre bil"}
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
