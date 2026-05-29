import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "./AutoRefresh";

// ---------- Typer ----------

type DriverInfo = { full_name: string } | null;

type TimeEntry = {
  check_in: string | null;
  check_out: string | null;
  comment: string | null;
  driver: DriverInfo;
};

type VehicleCheck = {
  status: string;
  comment: string | null;
};

type Shift = {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
  has_co_driver: boolean;
  status: string;
  date: string;
  route: { name: string; route_number: string | null } | null;
  vehicle: { reg_number: string; make: string; model: string } | null;
  time_entry: TimeEntry[];
  vehicle_check: VehicleCheck[];
};

type Farge = "gray" | "green" | "yellow" | "red";

// ---------- Hjelpere ----------

// Timestamp (ISO-streng) → "HH:MM" i norsk tidssone.
function kl(ts: string | null): string {
  if (!ts) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

// Beregn fargestatus basert på planlagt start vs. inn-stempling.
// Logikk iflg. CLAUDE.md:
//   grå  = shift har ikke startet (planned_start i fremtiden, eller ingen start-tid)
//   grønn = har check_in (uansett tidspunkt)
//   gul  = 5–10 min etter planned_start uten check_in
//   rød  = >10 min etter planned_start uten check_in
function beregnFarge(shift: Shift, now: Date): Farge {
  const te = shift.time_entry[0];
  if (te?.check_in) return "green";
  if (!shift.planned_start) return "gray";

  const start = new Date(shift.planned_start);
  const diffMin = (now.getTime() - start.getTime()) / 60_000;

  if (diffMin < 0) return "gray";    // før start
  if (diffMin <= 5) return "gray";   // 0–5 min: innen normal innstemplingsvindu
  if (diffMin <= 10) return "yellow";
  return "red";
}

// Visuell konfigurasjon pr. fargestatus.
const FARGE_CONFIG: Record<
  Farge,
  { bg: string; text: string; dotColor: string; label: string }
> = {
  gray:   { bg: "#F1F0ED", text: "#6E6E6E", dotColor: "#8a8780", label: "Ikke startet"    },
  green:  { bg: "#e5f1e9", text: "#00643a", dotColor: "#00643a", label: "Stemplet inn"    },
  yellow: { bg: "#FFF2D3", text: "#7A5108", dotColor: "#D4860C", label: "Advarsel"        },
  red:    { bg: "#FCE5E2", text: "#c7261b", dotColor: "#c7261b", label: "Ikke stemplet"   },
};

// ---------- Side ----------

export default async function DagsoversiktPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();

  // Dagens dato i norsk tidssone på formatet YYYY-MM-DD (sv-locale gir ISO-dato).
  const today = new Intl.DateTimeFormat("sv", {
    timeZone: "Europe/Oslo",
  }).format(now);

  // Hent alle vakter for i dag med alle relaterte data.
  const { data, error } = await supabase
    .from("shift")
    .select(
      `id, planned_start, planned_end, has_co_driver, status, date,
       route:route_id (name, route_number),
       vehicle:vehicle_id (reg_number, make, model),
       time_entry (check_in, check_out, comment, driver:driver_id (full_name)),
       vehicle_check (status, comment)`,
    )
    .eq("date", today)
    .order("planned_start", { ascending: true, nullsFirst: false });

  const skift = (data ?? []) as unknown as Shift[];

  // Beregn farge for alle skift én gang (brukes både i stats og tabell).
  const fargeListe = skift.map((s) => beregnFarge(s, now));
  const antall = (f: Farge) => fargeListe.filter((x) => x === f).length;

  const stats = [
    {
      label: "Vakter i dag",
      verdi: skift.length,
      farge: "gray" as Farge,
    },
    {
      label: "Stemplet inn",
      verdi: antall("green"),
      farge: "green" as Farge,
    },
    {
      label: "Advarsel (5–10 min)",
      verdi: antall("yellow"),
      farge: "yellow" as Farge,
    },
    {
      label: "Ikke stemplet (>10 min)",
      verdi: antall("red"),
      farge: "red" as Farge,
    },
  ];

  // Overskrift: lang norsk dato ("mandag 29. mai 2026").
  const dagLabel = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const oppdatertKl = kl(now.toISOString());

  return (
    <div className="px-[38px] py-[30px]">
      <AutoRefresh />

      {/* ---------- Topplinje ---------- */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-tertiary)" }}
        >
          Drift
        </p>
        <h1
          className="mt-1 text-[32px] font-medium capitalize tracking-tight"
          style={{ color: "var(--bring-green)" }}
        >
          Dagsoversikt
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          {dagLabel} · Oppdateres hvert minutt · Sist hentet kl.{" "}
          <span style={{ fontFamily: "var(--font-dm-mono)" }}>{oppdatertKl}</span>
        </p>
      </div>

      {/* ---------- Fargeforklaring ---------- */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {(["gray", "green", "yellow", "red"] as Farge[]).map((f) => {
          const cfg = FARGE_CONFIG[f];
          return (
            <span
              key={f}
              className="flex items-center gap-1.5 text-[12.5px]"
              style={{ color: cfg.text }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: cfg.dotColor }}
              />
              {f === "red" && "⚠ "}
              {cfg.label}
            </span>
          );
        })}
      </div>

      {/* ---------- Statistikk-kort ---------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const cfg = FARGE_CONFIG[s.farge];
          const erAdvarsel = (s.farge === "yellow" || s.farge === "red") && s.verdi > 0;
          return (
            <div
              key={s.label}
              className="rounded-2xl p-4 shadow-sm"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <p
                className="text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {s.label}
              </p>
              <p
                className="mt-1 text-[28px] font-medium tracking-tight"
                style={{ color: erAdvarsel ? cfg.text : "var(--foreground)" }}
              >
                {s.verdi}
              </p>
            </div>
          );
        })}
      </div>

      {/* ---------- Feilmelding ---------- */}
      {error && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente vakter: {error.message}
        </p>
      )}

      {/* ---------- Vakter-tabell ---------- */}
      <div
        className="mt-6 overflow-x-auto overflow-hidden rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {skift.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen vakter er planlagt for i dag.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr
                className="text-[12px] uppercase tracking-wide"
                style={{
                  color: "var(--text-tertiary)",
                  backgroundColor: "#FBFBFA",
                }}
              >
                {[
                  "Status",
                  "Rute",
                  "Bil",
                  "Planlagt tid",
                  "Sjåfør",
                  "Inn",
                  "Ut",
                  "Bilsjekk",
                  "Kommentar",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skift.map((s, i) => {
                const farge = fargeListe[i];
                const cfg = FARGE_CONFIG[farge];
                const te = s.time_entry[0] ?? null;
                const vc = s.vehicle_check[0] ?? null;
                const erAvlyst = s.status === "avlyst";

                const planlagtTid =
                  s.planned_start || s.planned_end
                    ? `${kl(s.planned_start)}–${kl(s.planned_end)}`
                    : "–";

                const kommentar = te?.comment ?? vc?.comment ?? null;

                return (
                  <tr
                    key={s.id}
                    className="border-t text-[14px]"
                    style={{
                      borderColor: "var(--border)",
                      opacity: erAvlyst ? 0.45 : 1,
                    }}
                  >
                    {/* Status-badge */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                        style={{ backgroundColor: cfg.bg, color: cfg.text }}
                      >
                        {farge === "red" && (
                          <span aria-label="Varseltrekant">⚠</span>
                        )}
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cfg.dotColor }}
                        />
                        {cfg.label}
                        {erAvlyst ? " · avlyst" : ""}
                      </span>
                    </td>

                    {/* Rute */}
                    <td className="px-4 py-3">
                      {s.route ? (
                        <>
                          <div className="font-medium">{s.route.name}</div>
                          {s.route.route_number && (
                            <div
                              className="text-[12.5px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              Nr.{" "}
                              {s.route.route_number}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Bil */}
                    <td className="px-4 py-3">
                      {s.vehicle ? (
                        <>
                          <div
                            className="font-medium"
                            style={{ fontFamily: "var(--font-dm-mono)" }}
                          >
                            {s.vehicle.reg_number}
                          </div>
                          <div
                            className="text-[12.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {s.vehicle.make} {s.vehicle.model}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Planlagt tid */}
                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {planlagtTid}
                      </span>
                      {s.has_co_driver && (
                        <span
                          className="ml-1.5 text-[11.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                          title="Krever sidemann"
                        >
                          +1
                        </span>
                      )}
                    </td>

                    {/* Sjåfør */}
                    <td className="px-4 py-3">
                      {te?.driver?.full_name ? (
                        <span>{te.driver.full_name}</span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Inn-tid */}
                    <td className="px-4 py-3">
                      {te?.check_in ? (
                        <span style={{ fontFamily: "var(--font-dm-mono)" }}>
                          {kl(te.check_in)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Ut-tid */}
                    <td className="px-4 py-3">
                      {te?.check_out ? (
                        <span style={{ fontFamily: "var(--font-dm-mono)" }}>
                          {kl(te.check_out)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Bilsjekk */}
                    <td className="px-4 py-3">
                      {vc ? (
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                          style={
                            vc.status === "ok"
                              ? { backgroundColor: "#e5f1e9", color: "#00643a" }
                              : { backgroundColor: "#FCE5E2", color: "#c7261b" }
                          }
                        >
                          {vc.status === "ok" ? "OK" : "Avvik"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
                      )}
                    </td>

                    {/* Kommentar */}
                    <td
                      className="max-w-[200px] px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {kommentar ? (
                        <span
                          className="block truncate text-[13px]"
                          title={kommentar}
                        >
                          {kommentar}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>–</span>
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
