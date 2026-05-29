import { createClient } from "@/lib/supabase/server";
import NyRute from "./NyRute";
import GenererVakter from "./GenererVakter";
import { kommendeDatoer } from "./dates";

type Shift = {
  id: string;
  route_id: string;
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

// "2026-05-30" → { ukedag: "fre", dag: "30.05." }
function dagLabel(dato: string) {
  const d = new Date(`${dato}T12:00:00Z`);
  const ukedag = new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    timeZone: "Europe/Oslo",
  }).format(d);
  const dag = new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(d);
  return { ukedag, dag };
}

export default async function RutemasterPage() {
  const supabase = await createClient();

  const datoer = kommendeDatoer(7);

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
        .select("id, route_id, date, driver_id, status")
        .gte("date", datoer[0])
        .lte("date", datoer[datoer.length - 1])
        .order("date"),
    ]);

  const ruter = (ruterRes.data ?? []) as Route[];
  const error = ruterRes.error;

  // Oppslag fra id → visningsnavn.
  const kundeNavn = new Map(
    (kunderRes.data ?? []).map((k) => [k.id, k.name as string]),
  );
  const bilNavn = new Map(
    (bilerRes.data ?? []).map((b) => [
      b.id,
      `${b.reg_number} (${b.make} ${b.model})`,
    ]),
  );
  const sjaforNavn = new Map(
    (sjaforerRes.data ?? []).map((s) => [s.id, s.full_name as string]),
  );

  // Valg til skjemaet.
  const kundeValg = (kunderRes.data ?? []).map((k) => ({
    id: k.id,
    navn: k.name as string,
  }));
  const bilValg = (bilerRes.data ?? []).map((b) => ({
    id: b.id,
    navn: `${b.reg_number} – ${b.make} ${b.model}`,
  }));
  const sjaforValg = (sjaforerRes.data ?? []).map((s) => ({
    id: s.id,
    navn: s.full_name as string,
  }));

  // Oppslag for ukesvisningen: rutenavn og rutetid pr. rute-id.
  const routeNavn = new Map(ruter.map((r) => [r.id, r.name]));
  const routeTid = new Map(
    ruter.map((r) => {
      const s = kl(r.start_time);
      const e = kl(r.end_time);
      return [r.id, s || e ? `${s ?? "?"}–${e ?? "?"}` : null] as const;
    }),
  );

  // Grupper vaktene pr. dato.
  const vakter = (vakterRes.data ?? []) as Shift[];
  const vakterPerDato = new Map<string, Shift[]>(datoer.map((d) => [d, []]));
  for (const v of vakter) {
    vakterPerDato.get(v.date)?.push(v);
  }

  const stats = [
    { label: "Ruter totalt", verdi: ruter.length },
    { label: "Aktive", verdi: ruter.filter((r) => r.active).length },
    { label: "Vakter denne uken", verdi: vakter.length },
  ];

  return (
    <div className="px-[38px] py-[30px]">
      <div className="flex items-start justify-between">
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

      <div className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 shadow-sm"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {s.label}
            </p>
            <p className="mt-1 text-[28px] font-medium tracking-tight">
              {s.verdi}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente ruter: {error.message}
        </p>
      )}

      {/* ---------- Ukesvisning (vakter) ---------- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight">Denne uken</h2>
        <GenererVakter />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {datoer.map((dato) => {
          const { ukedag, dag } = dagLabel(dato);
          const dagensVakter = vakterPerDato.get(dato) ?? [];
          return (
            <div
              key={dato}
              className="rounded-2xl p-3 shadow-sm"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span
                  className="text-[13px] font-semibold capitalize"
                  style={{ color: "var(--foreground)" }}
                >
                  {ukedag}
                </span>
                <span
                  className="text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {dag}
                </span>
              </div>
              {dagensVakter.length === 0 ? (
                <p
                  className="py-2 text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Ingen vakter
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {dagensVakter.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-[8px] px-2.5 py-1.5"
                      style={{ backgroundColor: "var(--background)" }}
                    >
                      <div className="text-[13px] font-medium">
                        {routeNavn.get(v.route_id) ?? "Rute"}
                      </div>
                      <div
                        className="text-[11.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {routeTid.get(v.route_id) ?? "–"}
                        {v.driver_id && sjaforNavn.get(v.driver_id)
                          ? ` · ${sjaforNavn.get(v.driver_id)}`
                          : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-medium tracking-tight">Alle ruter</h2>

      <div
        className="mt-6 overflow-hidden rounded-2xl shadow-sm"
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
                      <span style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {tid}
                      </span>
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
