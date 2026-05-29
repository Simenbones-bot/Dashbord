import { createClient } from "@/lib/supabase/server";
import NyRute from "./NyRute";
import { kundeFarger, NOYTRAL, type Farge } from "./farger";

type Route = {
  id: string;
  name: string;
  route_number: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  co_driver_id: string | null;
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

const GRID_KOLONNER = "180px repeat(7, minmax(0, 1fr))";

export default async function RutemasterPage() {
  const supabase = await createClient();

  const [ruterRes, kunderRes, bilerRes, sjaforerRes] = await Promise.all([
    supabase
      .from("route")
      .select(
        "id, name, route_number, customer_id, vehicle_id, driver_id, co_driver_id, start_time, end_time, distance_km, weekdays, revenue_per_hour, active",
      )
      .order("created_at", { ascending: false }),
    supabase.from("customer").select("id, name").order("name"),
    supabase.from("vehicle").select("id, reg_number, make, model").order("reg_number"),
    supabase.from("driver").select("id, full_name").order("full_name"),
  ]);

  const ruter = (ruterRes.data ?? []) as Route[];
  const biler = bilerRes.data ?? [];
  const error = ruterRes.error;

  // Bare aktive ruter inngår i ukesmalen.
  const aktiveRuter = ruter.filter((r) => r.active);

  // ---------- Oppslag ----------
  const kundeNavn = new Map(
    (kunderRes.data ?? []).map((k) => [k.id, k.name as string]),
  );
  const sjaforNavn = new Map(
    (sjaforerRes.data ?? []).map((s) => [s.id, s.full_name as string]),
  );
  const bilNavn = new Map(
    biler.map((b) => [b.id, `${b.reg_number} (${b.make} ${b.model})`]),
  );

  const farger = kundeFarger((kunderRes.data ?? []).map((k) => k.id));
  const fargeFor = (kundeId: string | null | undefined): Farge =>
    (kundeId && farger.get(kundeId)) || NOYTRAL;

  // ---------- Bygg rader (pr. bil) ----------
  // Nøkkel "bilId|ukedag" → ruter. Ruter uten bil samles under "UTEN".
  const perBilDag = new Map<string, Route[]>();
  const bilerMedRute = new Set<string>();
  const bilSjafor = new Map<string, string>();
  let harUtenBil = false;

  for (const r of aktiveRuter) {
    const bilNokkel = r.vehicle_id ?? "UTEN";
    if (r.vehicle_id) bilerMedRute.add(r.vehicle_id);
    else harUtenBil = true;
    if (r.vehicle_id && r.driver_id && !bilSjafor.has(r.vehicle_id)) {
      bilSjafor.set(r.vehicle_id, r.driver_id);
    }
    for (const dag of r.weekdays ?? []) {
      const k = `${bilNokkel}|${dag}`;
      (perBilDag.get(k) ?? perBilDag.set(k, []).get(k)!).push(r);
    }
  }

  type Rad = {
    id: string;
    tittel: string;
    undertittel: string;
    sjaforNavn: string | null;
  };
  const rader: Rad[] = biler
    .filter((b) => bilerMedRute.has(b.id))
    .map((b) => ({
      id: b.id,
      tittel: b.reg_number,
      undertittel: `${b.make} ${b.model}`,
      sjaforNavn: bilSjafor.has(b.id)
        ? sjaforNavn.get(bilSjafor.get(b.id)!) ?? null
        : null,
    }));
  if (harUtenBil) {
    rader.push({
      id: "UTEN",
      tittel: "Uten bil",
      undertittel: "Ikke tildelt",
      sjaforNavn: null,
    });
  }

  // Arbeidsvindu: tidligste start- og seneste sluttime blant de aktive rutene.
  let minStart = 24;
  let maxSlutt = 0;
  for (const r of aktiveRuter) {
    if (r.start_time) minStart = Math.min(minStart, Number(r.start_time.slice(0, 2)));
    if (r.end_time) {
      const h = Number(r.end_time.slice(0, 2)) + (Number(r.end_time.slice(3, 5)) > 0 ? 1 : 0);
      maxSlutt = Math.max(maxSlutt, h);
    }
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const arbVindu =
    minStart <= maxSlutt ? `Arb.vindu ${pad(minStart)}–${pad(maxSlutt)}` : "Bil";

  // Kunder som har aktive ruter (til fargeforklaring).
  const kunderIVisning = new Map<string, string>();
  for (const r of aktiveRuter) {
    if (r.customer_id && kundeNavn.has(r.customer_id)) {
      kunderIVisning.set(r.customer_id, kundeNavn.get(r.customer_id)!);
    }
  }

  // Valg til skjemaet.
  const kundeValg = (kunderRes.data ?? []).map((k) => ({
    id: k.id,
    navn: k.name as string,
  }));
  const bilValg = biler.map((b) => ({
    id: b.id,
    navn: `${b.reg_number} – ${b.make} ${b.model}`,
  }));
  const sjaforValg = (sjaforerRes.data ?? []).map((s) => ({
    id: s.id,
    navn: s.full_name as string,
  }));

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
            Standard-uke. Vaktene lages automatisk 7 dager frem og vises i
            dagsoversikten.
          </p>
        </div>
        <NyRute kunder={kundeValg} biler={bilValg} sjaforer={sjaforValg} />
      </div>

      {error && (
        <p
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente ruter: {error.message}
        </p>
      )}

      {/* ---------- Fargeforklaring (kunder) ---------- */}
      {kunderIVisning.size > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {[...kunderIVisning.entries()].map(([id, navn]) => (
            <span key={id} className="flex items-center gap-1.5 text-[12.5px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: fargeFor(id).solid }}
              />
              {navn}
            </span>
          ))}
        </div>
      )}

      {/* ---------- Ukesmal: rader = biler, kolonner = ukedager ---------- */}
      <div
        className="mt-4 overflow-x-auto rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div style={{ minWidth: 920 }}>
          {/* Hode */}
          <div
            className="grid border-b text-[12px]"
            style={{ gridTemplateColumns: GRID_KOLONNER, borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-3 font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              {arbVindu}
            </div>
            {UKEDAGER.map((u) => (
              <div
                key={u.nr}
                className="border-l px-3 py-3 font-semibold"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  backgroundColor: u.nr >= 6 ? "#FBFBFA" : "transparent",
                }}
              >
                {u.kort}
              </div>
            ))}
          </div>

          {/* Rader */}
          {rader.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ingen aktive ruter ennå. Trykk <strong>Ny rute</strong> for å
                legge inn den første.
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
                  {rad.sjaforNavn && (
                    <div className="mt-0.5 text-[12.5px]">{rad.sjaforNavn}</div>
                  )}
                </div>

                {/* Dagceller */}
                {UKEDAGER.map((u) => {
                  const celleRuter = perBilDag.get(`${rad.id}|${u.nr}`) ?? [];
                  return (
                    <div
                      key={u.nr}
                      className="border-l p-1.5"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: u.nr >= 6 ? "#FBFBFA" : "transparent",
                      }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {celleRuter.map((r) => {
                          const f = fargeFor(r.customer_id);
                          const kundeTekst = r.customer_id
                            ? kundeNavn.get(r.customer_id) ?? "—"
                            : "—";
                          const start = kl(r.start_time);
                          return (
                            <div
                              key={r.id}
                              className="min-w-[64px] flex-1 rounded-[8px] px-2 py-1.5"
                              style={{
                                backgroundColor: f.soft,
                                borderLeft: `3px solid ${f.solid}`,
                              }}
                              title={`${r.route_number ? r.route_number + " · " : ""}${kundeTekst}${start ? " · " + start : ""}`}
                            >
                              {r.route_number && (
                                <div
                                  className="truncate text-[10.5px] font-semibold"
                                  style={{ color: f.solid }}
                                >
                                  {r.route_number}
                                </div>
                              )}
                              <div className="truncate text-[12px] font-medium">
                                {kundeTekst}
                              </div>
                              {start && (
                                <div
                                  className="text-[11px]"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  {start}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------- Alle ruter (tabell for redigering/oversikt) ---------- */}
      <h2 className="mt-8 text-lg font-medium tracking-tight">Alle ruter</h2>

      <div
        className="mt-3 overflow-hidden rounded-2xl shadow-sm"
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
                <th className="px-4 py-3 font-semibold">Rute</th>
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold">Bil</th>
                <th className="px-4 py-3 font-semibold">Sjåfør</th>
                <th className="px-4 py-3 font-semibold">Tid</th>
                <th className="px-4 py-3 font-semibold">Dager</th>
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
                return (
                  <tr
                    key={r.id}
                    className="border-t text-[14px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      {r.route_number && (
                        <div
                          className="text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          Nr. {r.route_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.customer_id ? kundeNavn.get(r.customer_id) ?? "–" : "–"}
                    </td>
                    <td className="px-4 py-3">
                      {r.vehicle_id ? bilNavn.get(r.vehicle_id) ?? "–" : "–"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {r.driver_id ? sjaforNavn.get(r.driver_id) ?? "–" : "–"}
                      </div>
                      {r.co_driver_id && (
                        <div
                          className="text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          + {sjaforNavn.get(r.co_driver_id) ?? "sidemann"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "var(--font-dm-mono)" }}>{tid}</span>
                    </td>
                    <td className="px-4 py-3">
                      {dager || (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                      {!r.active && (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-[11px]"
                          style={{ backgroundColor: "#F1F0ED", color: "#6E6E6E" }}
                        >
                          inaktiv
                        </span>
                      )}
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
