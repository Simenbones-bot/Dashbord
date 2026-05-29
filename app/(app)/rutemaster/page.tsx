import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NyRute from "./NyRute";
import GenererVakter from "./GenererVakter";
import { ukeData } from "./dates";
import { kundeFarger, NOYTRAL, type Farge } from "./farger";

type Shift = {
  id: string;
  route_id: string;
  vehicle_id: string | null;
  date: string;
  driver_id: string | null;
  status: string;
};

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
  interval_days: number;
  revenue_per_hour: number | null;
  active: boolean;
};

// Postgres "time" kommer som "HH:MM:SS" – vis bare timer og minutter.
const kl = (t: string | null) => (t ? t.slice(0, 5) : null);

const intervallTekst = (n: number) =>
  n === 1 ? "Hver dag" : `Hver ${n}. dag`;

// "2026-05-26" → "26. mai"
function datoKort(dato: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dato}T12:00:00Z`));
}

// "2026-05-26" → "MAN"
function ukedagKort(dato: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${dato}T12:00:00Z`))
    .toUpperCase();
}

const GRID_KOLONNER = "180px repeat(7, minmax(0, 1fr))";

export default async function RutemasterPage({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string }>;
}) {
  const sp = await searchParams;
  const offset = Math.trunc(Number(sp?.uke ?? 0)) || 0;
  const uke = ukeData(offset);
  const datoer = uke.datoer;

  const supabase = await createClient();

  // Hent ruter + vakter for uken + listene vi trenger for navn og skjema.
  const [ruterRes, kunderRes, bilerRes, sjaforerRes, vakterRes] =
    await Promise.all([
      supabase
        .from("route")
        .select(
          "id, name, route_number, customer_id, vehicle_id, driver_id, co_driver_id, start_time, end_time, distance_km, interval_days, revenue_per_hour, active",
        )
        .order("created_at", { ascending: false }),
      supabase.from("customer").select("id, name").order("name"),
      supabase
        .from("vehicle")
        .select("id, reg_number, make, model")
        .order("reg_number"),
      supabase.from("driver").select("id, full_name").order("full_name"),
      supabase
        .from("shift")
        .select("id, route_id, vehicle_id, date, driver_id, status")
        .gte("date", datoer[0])
        .lte("date", datoer[datoer.length - 1])
        .order("date"),
    ]);

  const ruter = (ruterRes.data ?? []) as Route[];
  const biler = bilerRes.data ?? [];
  const vakter = (vakterRes.data ?? []) as Shift[];
  const error = ruterRes.error || vakterRes.error;

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
  const routeInfo = new Map(
    ruter.map((r) => [
      r.id,
      {
        nummer: r.route_number,
        kundeId: r.customer_id,
        start: kl(r.start_time),
      },
    ]),
  );

  // Fast farge pr. kunde (stabil rekkefølge fra kunde-listen).
  const farger = kundeFarger((kunderRes.data ?? []).map((k) => k.id));
  const fargeFor = (kundeId: string | null | undefined): Farge =>
    (kundeId && farger.get(kundeId)) || NOYTRAL;

  // ---------- Bygg rader (pr. bil) + oppslag for kort ----------
  // Nøkkel "bilId|dato" → vakter. Vakter uten bil samles under "UTEN".
  const perBilDag = new Map<string, Shift[]>();
  const bilerMedVakt = new Set<string>();
  const bilSjafor = new Map<string, string>(); // representativ sjåfør pr. bil
  let harUtenBil = false;

  for (const v of vakter) {
    const bilNokkel = v.vehicle_id ?? "UTEN";
    if (v.vehicle_id) bilerMedVakt.add(v.vehicle_id);
    else harUtenBil = true;
    const k = `${bilNokkel}|${v.date}`;
    (perBilDag.get(k) ?? perBilDag.set(k, []).get(k)!).push(v);
    if (v.vehicle_id && v.driver_id && !bilSjafor.has(v.vehicle_id)) {
      bilSjafor.set(v.vehicle_id, v.driver_id);
    }
  }

  type Rad = {
    id: string;
    tittel: string; // reg.nr eller "Uten bil"
    undertittel: string; // merke/modell
    sjaforNavn: string | null;
  };
  const rader: Rad[] = biler
    .filter((b) => bilerMedVakt.has(b.id))
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

  // Arbeidsvindu: tidligste start- og seneste sluttime blant rutene i uken.
  let minStart = 24;
  let maxSlutt = 0;
  for (const v of vakter) {
    const r = ruter.find((x) => x.id === v.route_id);
    if (r?.start_time) minStart = Math.min(minStart, Number(r.start_time.slice(0, 2)));
    if (r?.end_time) {
      const t = r.end_time;
      const h = Number(t.slice(0, 2)) + (Number(t.slice(3, 5)) > 0 ? 1 : 0);
      maxSlutt = Math.max(maxSlutt, h);
    }
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const arbVindu =
    minStart <= maxSlutt ? `Arb.vindu ${pad(minStart)}–${pad(maxSlutt)}` : "Bil";

  // Kunder som faktisk har vakter i uken (til fargeforklaring).
  const kunderIVisning = new Map<string, string>();
  for (const v of vakter) {
    const kId = routeInfo.get(v.route_id)?.kundeId;
    if (kId && kundeNavn.has(kId)) kunderIVisning.set(kId, kundeNavn.get(kId)!);
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
        </div>
        <NyRute kunder={kundeValg} biler={bilValg} sjaforer={sjaforValg} />
      </div>

      {/* ---------- Verktøylinje: ukenavigasjon + handlinger ---------- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-[12px] p-1"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <PilLenke uke={offset - 1} retning="forrige" />
            <div className="px-2 text-center">
              <span className="text-[14px] font-semibold">Uke {uke.ukenummer}</span>
              <span
                className="ml-2 text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {uke.label}
              </span>
            </div>
            <PilLenke uke={offset + 1} retning="neste" />
          </div>
          <Link
            href="/rutemaster"
            aria-disabled={uke.erDenneUken}
            className="h-[38px] rounded-[10px] px-3 text-sm font-medium leading-[38px]"
            style={{
              border: "1px solid var(--border)",
              color: uke.erDenneUken ? "var(--text-tertiary)" : "var(--foreground)",
              backgroundColor: "var(--surface)",
              pointerEvents: uke.erDenneUken ? "none" : "auto",
            }}
          >
            Denne uka
          </Link>
        </div>
        <GenererVakter />
      </div>

      {error && (
        <p
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente data: {error.message}
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

      {/* ---------- Gantt: rader = biler, kolonner = dager ---------- */}
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
            {datoer.map((d, i) => (
              <div
                key={d}
                className="border-l px-3 py-3"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: i >= 5 ? "#FBFBFA" : "transparent",
                }}
              >
                <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                  {ukedagKort(d)}
                </div>
                <div style={{ color: "var(--text-tertiary)" }}>{datoKort(d)}</div>
              </div>
            ))}
          </div>

          {/* Rader */}
          {rader.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ingen vakter denne uken. Trykk{" "}
                <strong>Generer vakter</strong> for å fylle opp – eller bytt uke.
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
                {datoer.map((d, i) => {
                  const celleVakter = perBilDag.get(`${rad.id}|${d}`) ?? [];
                  return (
                    <div
                      key={d}
                      className="border-l p-1.5"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: i >= 5 ? "#FBFBFA" : "transparent",
                      }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {celleVakter.map((v) => {
                          const info = routeInfo.get(v.route_id);
                          const f = fargeFor(info?.kundeId);
                          const kundeTekst = info?.kundeId
                            ? kundeNavn.get(info.kundeId) ?? "—"
                            : "—";
                          return (
                            <div
                              key={v.id}
                              className="min-w-[64px] flex-1 rounded-[8px] px-2 py-1.5"
                              style={{
                                backgroundColor: f.soft,
                                borderLeft: `3px solid ${f.solid}`,
                              }}
                              title={`${info?.nummer ? info.nummer + " · " : ""}${kundeTekst}${info?.start ? " · " + info.start : ""}`}
                            >
                              {info?.nummer && (
                                <div
                                  className="truncate text-[10.5px] font-semibold"
                                  style={{ color: f.solid }}
                                >
                                  {info.nummer}
                                </div>
                              )}
                              <div className="truncate text-[12px] font-medium">
                                {kundeTekst}
                              </div>
                              {info?.start && (
                                <div
                                  className="text-[11px]"
                                  style={{ color: "var(--text-tertiary)" }}
                                >
                                  {info.start}
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
                <th className="px-4 py-3 font-semibold">Intervall</th>
              </tr>
            </thead>
            <tbody>
              {ruter.map((r) => {
                const start = kl(r.start_time);
                const slutt = kl(r.end_time);
                const tid =
                  start || slutt ? `${start ?? "?"}–${slutt ?? "?"}` : "–";
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
                    <td className="px-4 py-3">{intervallTekst(r.interval_days)}</td>
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

// Pil for ukenavigasjon (lenke som bytter ?uke=…).
function PilLenke({ uke, retning }: { uke: number; retning: "forrige" | "neste" }) {
  return (
    <Link
      href={uke === 0 ? "/rutemaster" : `/rutemaster?uke=${uke}`}
      aria-label={retning === "forrige" ? "Forrige uke" : "Neste uke"}
      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[18px] leading-none"
      style={{ color: "var(--text-secondary)" }}
    >
      {retning === "forrige" ? "‹" : "›"}
    </Link>
  );
}
