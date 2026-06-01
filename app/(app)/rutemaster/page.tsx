import { createClient } from "@/lib/supabase/server";
import NyRute from "./NyRute";
import RuteHandlinger from "./RuteHandlinger";
import { typeLabel, kategoriLabel, bemanningLabel, STANDARD_FARGE } from "./constants";
import type { RuteData, Valg } from "./RuteSkjema";

type Route = {
  id: string;
  name: string;
  route_number: string | null;
  customer_id: string | null;
  route_type: string | null;
  color: string | null;
  vehicle_category: string | null;
  has_co_driver: boolean;
  vehicles_needed: number;
  vehicle_ids: string[] | null;
  start_time: string | null;
  end_time: string | null;
  distance_km: number | null;
  weekdays: number[] | null;
  revenue_per_hour: number | null;
  active: boolean;
};

// ISO-ukedager: 1 = mandag … 7 = søndag.
const UKEDAGER = [
  { nr: 1, kort: "MAN" },
  { nr: 2, kort: "TIR" },
  { nr: 3, kort: "ONS" },
  { nr: 4, kort: "TOR" },
  { nr: 5, kort: "FRE" },
  { nr: 6, kort: "LØR" },
  { nr: 7, kort: "SØN" },
];
const DAG_KORT: Record<number, string> = {
  1: "Man",
  2: "Tir",
  3: "Ons",
  4: "Tor",
  5: "Fre",
  6: "Lør",
  7: "Søn",
};

// Postgres "time" kommer som "HH:MM:SS" – vis bare timer og minutter.
const kl = (t: string | null) => (t ? t.slice(0, 5) : null);
// "06:30:00" → 6.5 (desimaltime), ellers null.
const timer = (t: string | null) =>
  t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null;

// Rutefarge → { solid: strek/aksent, soft: lys bakgrunn (10% alpha) }.
const stolpeFarge = (hex: string | null) => {
  const c = hex ?? STANDARD_FARGE;
  return { solid: c, soft: c + "1A" };
};

const GRID_KOLONNER = "180px repeat(7, minmax(0, 1fr))";
const LANE_H = 38; // høyde pr. rute-stolpe
const pad = (n: number) => String(n).padStart(2, "0");

export default async function RutemasterPage() {
  const supabase = await createClient();

  const [ruterRes, kunderRes, bilerRes] = await Promise.all([
    supabase
      .from("route")
      .select(
        "id, name, route_number, customer_id, route_type, color, vehicle_category, has_co_driver, vehicles_needed, vehicle_ids, start_time, end_time, distance_km, weekdays, revenue_per_hour, active",
      )
      .order("created_at", { ascending: false }),
    supabase.from("customer").select("id, name").order("name"),
    supabase.from("vehicle").select("id, reg_number, make, model").order("reg_number"),
  ]);

  const ruter = (ruterRes.data ?? []) as Route[];
  const biler = bilerRes.data ?? [];
  const error = ruterRes.error;

  const aktiveRuter = ruter.filter((r) => r.active);

  // ---------- Oppslag ----------
  const kundeNavn = new Map(
    (kunderRes.data ?? []).map((k) => [k.id, k.name as string]),
  );
  const regById = new Map(biler.map((b) => [b.id, b.reg_number as string]));

  const bilerAv = (r: Route) => r.vehicle_ids ?? [];

  // ---------- Rutene pr. bil + ukedag (én rute kan ligge under flere biler) ----------
  const perBilDag = new Map<string, Route[]>();
  let harUtenBil = false;
  for (const r of aktiveRuter) {
    const tildelte = bilerAv(r);
    const nokler = tildelte.length > 0 ? tildelte : ["UTEN"];
    if (tildelte.length === 0) harUtenBil = true;
    for (const bilNokkel of nokler) {
      for (const dag of r.weekdays ?? []) {
        const k = `${bilNokkel}|${dag}`;
        (perBilDag.get(k) ?? perBilDag.set(k, []).get(k)!).push(r);
      }
    }
  }

  // Rader: ALLE biler på enheten (også uten oppdrag) + evt. "Uten bil".
  type Rad = { id: string; tittel: string; undertittel: string };
  const rader: Rad[] = biler.map((b) => ({
    id: b.id,
    tittel: b.reg_number,
    undertittel: `${b.make} ${b.model}`,
  }));
  if (harUtenBil) {
    rader.push({ id: "UTEN", tittel: "Uten bil", undertittel: "Ikke tildelt" });
  }

  // ---------- Tidsskala (hele døgnet) ----------
  const skalaStart = 0;
  const skalaSlutt = 24;
  const totalT = skalaSlutt - skalaStart; // 24 timer
  const timePct = 100 / totalT;
  const skalaTekst = `${pad(skalaStart)}–${pad(skalaSlutt)}`;

  // Timemerker langs toppen (hver 2. time over hele døgnet).
  const steg = 2;
  const timeMerker: number[] = [];
  for (let h = skalaStart; h <= skalaSlutt; h += steg) timeMerker.push(h);

  // Faste gridlinjer (én strek pr. time) som bakgrunn i cellene.
  const gridBakgrunn = {
    backgroundImage: `repeating-linear-gradient(to right, #F0EFEC 0, #F0EFEC 1px, transparent 1px, transparent ${timePct}%)`,
  };

  // ---------- Valg + data til skjemaet ----------
  const kundeValg: Valg[] = (kunderRes.data ?? []).map((k) => ({
    id: k.id,
    navn: k.name as string,
  }));
  const bilValg: Valg[] = biler.map((b) => ({
    id: b.id,
    navn: `${b.reg_number} – ${b.make} ${b.model}`,
  }));

  const tilRuteData = (r: Route): RuteData => ({
    id: r.id,
    name: r.name,
    route_number: r.route_number,
    customer_id: r.customer_id,
    route_type: r.route_type,
    color: r.color,
    vehicle_category: r.vehicle_category,
    has_co_driver: r.has_co_driver,
    vehicles_needed: r.vehicles_needed,
    vehicle_ids: r.vehicle_ids ?? [],
    start_time: r.start_time,
    end_time: r.end_time,
    distance_km: r.distance_km,
    weekdays: r.weekdays,
    revenue_per_hour: r.revenue_per_hour,
  });

  return (
    <div className="px-[38px] py-[30px]">
      {/* ---------- Topplinje ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-tertiary)" }}
          >
            Drift
          </p>
          <h1
            className="mt-1 text-[32px] font-medium tracking-tight"
            style={{ color: "var(--bring-green)" }}
          >
            Rutemaster
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Standard-uke. Én rute kan ha flere biler – det lages én vakt pr. bil
            pr. dag i dagsoversikten.
          </p>
        </div>
        <NyRute kunder={kundeValg} biler={bilValg} />
      </div>

      {error && (
        <p
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente ruter: {error.message}
        </p>
      )}

      {/* ---------- Ukesmal med tidslinje ---------- */}
      <div
        className="mt-5 overflow-x-auto rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div style={{ minWidth: 1040 }}>
          {/* Dag-hode */}
          <div
            className="grid border-b text-[12px]"
            style={{ gridTemplateColumns: GRID_KOLONNER, borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2 font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Tid {skalaTekst}
            </div>
            {UKEDAGER.map((u) => (
              <div
                key={u.nr}
                className="border-l px-3 pt-2 font-semibold"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  backgroundColor: u.nr >= 6 ? "#FBFBFA" : "transparent",
                }}
              >
                {u.kort}
                {/* Timelinjal */}
                <div className="relative mt-1 h-3" style={{ fontWeight: 400 }}>
                  {timeMerker.map((h) => (
                    <span
                      key={h}
                      className="absolute -translate-x-1/2 text-[9.5px]"
                      style={{
                        left: `${(h - skalaStart) * timePct}%`,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {pad(h)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Rader */}
          {rader.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ingen biler ennå. Legg inn biler under <strong>Biler</strong>.
              </p>
            </div>
          ) : (
            rader.map((rad) => (
              <div
                key={rad.id}
                className="grid border-b"
                style={{ gridTemplateColumns: GRID_KOLONNER, borderColor: "var(--border)" }}
              >
                {/* Bil-etikett */}
                <div className="px-4 py-3">
                  <div
                    className="text-[13.5px] font-semibold"
                    style={{ fontFamily: "var(--font-dm-mono)" }}
                  >
                    {rad.tittel}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {rad.undertittel}
                  </div>
                </div>

                {/* Dagceller med tidslinje */}
                {UKEDAGER.map((u) => {
                  const celleRuter = perBilDag.get(`${rad.id}|${u.nr}`) ?? [];
                  const hoyde = Math.max(celleRuter.length, 1) * (LANE_H + 4) + 4;
                  return (
                    <div
                      key={u.nr}
                      className="relative border-l"
                      style={{
                        borderColor: "var(--border)",
                        minHeight: hoyde,
                        ...gridBakgrunn,
                        ...(u.nr >= 6 ? { backgroundColor: "#FBFBFA" } : {}),
                      }}
                    >
                      {celleRuter.map((r, i) => {
                        const f = stolpeFarge(r.color);
                        const kundeTekst = r.customer_id
                          ? kundeNavn.get(r.customer_id) ?? "—"
                          : "—";
                        const sH = timer(r.start_time);
                        const eHraw = timer(r.end_time);
                        const eH = eHraw ?? (sH != null ? sH + 1 : null);
                        const harTid = sH != null;
                        const left = harTid
                          ? Math.max((sH - skalaStart) * timePct, 0)
                          : 0;
                        const width = harTid
                          ? Math.min(
                              Math.max(((eH! - sH) * timePct), 6),
                              100 - left,
                            )
                          : 100;
                        const tidTekst =
                          kl(r.start_time) && kl(r.end_time)
                            ? `${kl(r.start_time)}–${kl(r.end_time)}`
                            : kl(r.start_time) ?? "";
                        return (
                          <div
                            key={r.id}
                            className="absolute overflow-hidden rounded-[7px] px-2 py-1"
                            style={{
                              top: 4 + i * (LANE_H + 4),
                              left: `${left}%`,
                              width: `${width}%`,
                              height: LANE_H,
                              backgroundColor: f.soft,
                              borderLeft: `3px solid ${f.solid}`,
                            }}
                            title={`${r.route_number ? r.route_number + " · " : ""}${kundeTekst}${tidTekst ? " · " + tidTekst : ""}${r.has_co_driver ? " · dobbel" : ""}`}
                          >
                            <div className="flex items-baseline gap-1">
                              {r.route_number && (
                                <span
                                  className="shrink-0 text-[10.5px] font-semibold"
                                  style={{ color: f.solid }}
                                >
                                  {r.route_number}
                                </span>
                              )}
                              <span className="truncate text-[11.5px] font-medium">
                                {kundeTekst}
                              </span>
                              <span
                                className="ml-auto shrink-0 text-[10px] font-semibold"
                                style={{ color: f.solid }}
                              >
                                {r.has_co_driver ? "2x" : "1x"}
                              </span>
                            </div>
                            <div
                              className="truncate text-[10.5px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {tidTekst}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------- Alle ruter (tabell for redigering/oversikt) ---------- */}
      <h2 className="mt-8 text-lg font-medium tracking-tight">
        Rutemaster ({ruter.length})
      </h2>

      <div
        className="mt-3 overflow-x-auto rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {ruter.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen ruter ennå. Trykk <strong>Ny rute</strong> for å legge inn
              den første.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr
                className="text-[12px] uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)", backgroundColor: "#FBFBFA" }}
              >
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Bemanning</th>
                <th className="px-4 py-3 font-semibold">Bil(er)</th>
                <th className="px-4 py-3 font-semibold">Tid</th>
                <th className="px-4 py-3 font-semibold">Dager</th>
                <th className="px-4 py-3 font-semibold">KM</th>
                <th className="px-4 py-3 font-semibold">KR/T</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Ruter</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {ruter.map((r) => {
                const start = kl(r.start_time);
                const slutt = kl(r.end_time);
                const tid =
                  start || slutt ? `${start ?? "?"}–${slutt ?? "?"}` : "–";
                const dager = (r.weekdays ?? [])
                  .map((d) => DAG_KORT[d])
                  .filter(Boolean)
                  .join(", ");
                const tildelte = r.vehicle_ids ?? [];
                const bilTekst =
                  tildelte.length > 0
                    ? tildelte.map((id) => regById.get(id) ?? "?").join(", ")
                    : "–";
                const nok = tildelte.length >= r.vehicles_needed;
                return (
                  <tr
                    key={r.id}
                    className="border-t text-[14px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.customer_id ? kundeNavn.get(r.customer_id) ?? "–" : "–"}
                      </div>
                      <div
                        className="text-[12.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {r.name}
                        {r.route_number ? ` · ${r.route_number}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium text-white"
                        style={{ backgroundColor: r.color ?? STANDARD_FARGE }}
                      >
                        {typeLabel(r.route_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{bemanningLabel(r.has_co_driver)}</td>
                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "var(--font-dm-mono)" }}>{bilTekst}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "var(--font-dm-mono)" }}>{tid}</span>
                    </td>
                    <td className="px-4 py-3">
                      {dager || <span style={{ color: "var(--text-tertiary)" }}>–</span>}
                      {!r.active && (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ backgroundColor: "#F1F0ED", color: "#6E6E6E" }}
                        >
                          inaktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.distance_km ?? "–"}</td>
                    <td className="px-4 py-3">{r.revenue_per_hour ?? "–"}</td>
                    <td className="px-4 py-3">{kategoriLabel(r.vehicle_category)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                        style={
                          nok
                            ? { backgroundColor: "#e5f1e9", color: "#00643a" }
                            : { backgroundColor: "#FCE5E2", color: "#c7261b" }
                        }
                      >
                        {tildelte.length}/{r.vehicles_needed}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RuteHandlinger
                        rute={tilRuteData(r)}
                        kunder={kundeValg}
                        biler={bilValg}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
