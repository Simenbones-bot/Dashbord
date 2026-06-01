"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { opprettRute, oppdaterRute } from "./actions";
import { RUTE_TYPER, KJORETOY_KATEGORIER, STANDARD_FARGE } from "./constants";

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

export type Valg = { id: string; navn: string };

export type RuteData = {
  id: string;
  name: string;
  route_number: string | null;
  customer_id: string | null;
  route_type: string | null;
  color: string | null;
  vehicle_category: string | null;
  has_co_driver: boolean;
  vehicles_needed: number;
  vehicle_ids: string[];
  start_time: string | null;
  end_time: string | null;
  distance_km: number | null;
  weekdays: number[] | null;
  revenue_per_hour: number | null;
};

const UKEDAGER: { nr: number; kort: string }[] = [
  { nr: 1, kort: "Man" },
  { nr: 2, kort: "Tir" },
  { nr: 3, kort: "Ons" },
  { nr: 4, kort: "Tor" },
  { nr: 5, kort: "Fre" },
  { nr: 6, kort: "Lør" },
  { nr: 7, kort: "Søn" },
];

// Rendres kun når skuffen er åpen (parent: {apen && <RuteSkjema .../>}), slik
// at all skjema-tilstand nullstilles/forhåndsfylles riktig hver gang.
export default function RuteSkjema({
  onClose,
  rute,
  kunder,
  biler,
}: {
  onClose: () => void;
  rute: RuteData | null;
  kunder: Valg[];
  biler: Valg[];
}) {
  const router = useRouter();
  const erRediger = rute != null;

  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [dager, setDager] = useState<number[]>(
    rute?.weekdays ?? [1, 2, 3, 4, 5],
  );
  const [sidemann, setSidemann] = useState<boolean>(rute?.has_co_driver ?? false);
  const [valgteBiler, setValgteBiler] = useState<string[]>(rute?.vehicle_ids ?? []);

  function veksleDag(nr: number) {
    setDager((d) =>
      d.includes(nr) ? d.filter((x) => x !== nr) : [...d, nr].sort(),
    );
  }
  function veksleBil(id: string) {
    setValgteBiler((b) =>
      b.includes(id) ? b.filter((x) => x !== id) : [...b, id],
    );
  }

  async function lagre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);

    const fd = new FormData(e.currentTarget);
    const res = erRediger
      ? await oppdaterRute(rute!.id, fd)
      : await opprettRute(fd);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Bakteppe */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
        onClick={onClose}
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
            {erRediger ? "Rediger kjøring" : "Ny rute"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Avbryt
          </button>
        </div>

        <form onSubmit={lagre} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Felt label="Rutenavn">
              <input
                name="name"
                required
                defaultValue={rute?.name ?? ""}
                placeholder="F.eks. Storo morgen"
                className="w-full px-3 py-2.5 text-[15px] outline-none"
                style={inputStil}
              />
            </Felt>
            <Felt label="Rutenummer">
              <input
                name="route_number"
                defaultValue={rute?.route_number ?? ""}
                placeholder="Valgfritt"
                className="w-full px-3 py-2.5 text-[15px] outline-none"
                style={inputStil}
              />
            </Felt>
          </div>

          <Felt label="Kunde">
            <select
              name="customer_id"
              defaultValue={rute?.customer_id ?? ""}
              className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
              style={inputStil}
            >
              <option value="">Velg …</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Felt>

          <div className="grid grid-cols-2 gap-3">
            <Felt label="Type">
              <select
                name="route_type"
                defaultValue={rute?.route_type ?? "fast_rute"}
                className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                style={inputStil}
              >
                {RUTE_TYPER.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Felt>
            <Felt label="Bemanning">
              <div className="flex gap-1.5">
                {[
                  { v: false, t: "Enkelt" },
                  { v: true, t: "Dobbel" },
                ].map((o) => {
                  const valgt = sidemann === o.v;
                  return (
                    <button
                      key={o.t}
                      type="button"
                      onClick={() => setSidemann(o.v)}
                      className="flex-1 rounded-[8px] px-3 py-2.5 text-[14px] font-medium"
                      style={
                        valgt
                          ? { backgroundColor: "var(--bring-green)", color: "#fff" }
                          : {
                              border: "1.5px solid var(--border-input)",
                              color: "var(--text-secondary)",
                            }
                      }
                    >
                      {o.t}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="has_co_driver" value={sidemann ? "true" : "false"} />
            </Felt>
          </div>

          <Felt label="Kjøretøykategori">
            <select
              name="vehicle_category"
              defaultValue={rute?.vehicle_category ?? ""}
              className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
              style={inputStil}
            >
              <option value="">Velg … (valgfritt)</option>
              {KJORETOY_KATEGORIER.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Felt>

          <Felt label="Farge">
            <input
              name="color"
              type="color"
              defaultValue={rute?.color ?? STANDARD_FARGE}
              className="h-10 w-full cursor-pointer rounded-[10px]"
              style={{ border: "1.5px solid var(--border-input)" }}
            />
          </Felt>

          <Felt label="Antall biler som trengs">
            <input
              name="vehicles_needed"
              type="number"
              min="1"
              defaultValue={rute?.vehicles_needed ?? 1}
              className="w-full px-3 py-2.5 text-[15px] outline-none"
              style={inputStil}
            />
          </Felt>

          <Felt label={`Biler (tildelt ${valgteBiler.length})`}>
            <div className="grid grid-cols-2 gap-1.5">
              {biler.length === 0 && (
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  Ingen biler ennå. Legg inn biler under «Biler».
                </p>
              )}
              {biler.map((b) => {
                const valgt = valgteBiler.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => veksleBil(b.id)}
                    className="rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium"
                    style={
                      valgt
                        ? { backgroundColor: "var(--green-soft)", color: "var(--bring-green)", border: "1.5px solid var(--bring-green)" }
                        : { border: "1.5px solid var(--border-input)", color: "var(--text-secondary)" }
                    }
                  >
                    {valgt ? "✓ " : ""}
                    {b.navn}
                  </button>
                );
              })}
            </div>
            {valgteBiler.map((id) => (
              <input key={id} type="hidden" name="vehicle_ids" value={id} />
            ))}
          </Felt>

          <div className="grid grid-cols-2 gap-3">
            <Felt label="Starttid">
              <TidVelger navn="start_time" initial={rute?.start_time ?? null} />
            </Felt>
            <Felt label="Sluttid">
              <TidVelger navn="end_time" initial={rute?.end_time ?? null} />
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
                        ? { backgroundColor: "var(--bring-green)", color: "#fff" }
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
                defaultValue={rute?.distance_km ?? ""}
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
                defaultValue={rute?.revenue_per_hour ?? ""}
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
            {laster ? "Lagrer …" : erRediger ? "Lagre endringer" : "Lagre rute"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Tidsvelger i 24-timers format (TT:MM) – to nedtrekk, alltid militærtid.
 * `initial` kan være "HH:MM" eller "HH:MM:SS" (fra databasen).
 */
function TidVelger({ navn, initial }: { navn: string; initial: string | null }) {
  const start = initial ? initial.slice(0, 5) : "";
  const [time, setTime] = useState(start ? start.slice(0, 2) : "");
  const [minutt, setMinutt] = useState(start ? start.slice(3, 5) : "");
  const verdi = time === "" ? "" : `${time}:${minutt || "00"}`;

  const timer = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutter = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full bg-white px-2 py-2.5 text-[15px] outline-none"
        style={inputStil}
      >
        <option value="">TT</option>
        {timer.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <span className="text-[15px]" style={{ color: "var(--text-tertiary)" }}>
        :
      </span>
      <select
        aria-label="Minutt"
        value={minutt}
        onChange={(e) => setMinutt(e.target.value)}
        className="w-full bg-white px-2 py-2.5 text-[15px] outline-none"
        style={inputStil}
      >
        <option value="">MM</option>
        {minutter.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input type="hidden" name={navn} value={verdi} />
    </div>
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
