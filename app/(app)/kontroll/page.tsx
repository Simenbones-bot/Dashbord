import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import KontrollPanel from "./KontrollPanel";

// ---------- Hjelpere for dato/tid (alt vises i norsk tid) ----------

function iDagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Flytter en "YYYY-MM-DD"-dato et antall dager frem/tilbake.
function skiftDato(d: string, dager: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + dager);
  return dt.toISOString().slice(0, 10);
}

function klokke(iso: string | null): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function datoLabel(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  const s = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, dd, 12)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Differanse i minutter mellom to tidspunkt (b - a). Null hvis noe mangler.
function diffMin(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

// Viser et minutt-tall som "+1t 15m", "−20m" eller "0m".
function visMinutter(min: number | null): string {
  if (min === null) return "–";
  if (min === 0) return "0m";
  const tegn = min > 0 ? "+" : "−";
  const a = Math.abs(min);
  const t = Math.floor(a / 60);
  const m = a % 60;
  return tegn + (t > 0 ? `${t}t ${m}m` : `${m}m`);
}

// Supabase typer en til-en-relasjon som objekt ELLER liste; hent forste trygt.
function forste<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

type Rad = {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
  route: { name: string | null; route_number: string | null } | { name: string | null; route_number: string | null }[] | null;
  vehicle: { reg_number: string; make: string; model: string } | { reg_number: string; make: string; model: string }[] | null;
  driver: { full_name: string } | { full_name: string }[] | null;
  time_entry:
    | {
        check_in: string | null;
        check_out: string | null;
        comment: string | null;
        driver: { full_name: string } | { full_name: string }[] | null;
      }[]
    | null;
};

type LoggRad = {
  id: string;
  action: string;
  actor_name: string | null;
  created_at: string;
};

export default async function KontrollPage({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string }>;
}) {
  const sp = await searchParams;
  const valgtDato =
    sp.dato && /^\d{4}-\d{2}-\d{2}$/.test(sp.dato) ? sp.dato : iDagOslo();

  const supabase = await createClient();

  // Vaktene for valgt dato, med rute/bil/sjafor + stempling (RLS sikrer at man
  // bare ser egen enhet).
  const { data: shiftData, error } = await supabase
    .from("shift")
    .select(
      `
      id, planned_start, planned_end,
      route:route_id ( name, route_number ),
      vehicle:vehicle_id ( reg_number, make, model ),
      driver:driver_id ( full_name ),
      time_entry ( check_in, check_out, comment, driver:driver_id ( full_name ) )
    `,
    )
    .eq("date", valgtDato)
    .order("planned_start", { ascending: true });

  const rader = (shiftData ?? []) as Rad[];

  // Status for dagskontrollen + revisjonslogg.
  const { data: closing } = await supabase
    .from("day_closing")
    .select("status, closed_by_name, closed_at, note")
    .eq("date", valgtDato)
    .maybeSingle();

  const { data: loggData } = await supabase
    .from("day_closing_log")
    .select("id, action, actor_name, created_at")
    .eq("date", valgtDato)
    .order("created_at", { ascending: false });

  const logg = (loggData ?? []) as LoggRad[];
  const erLukket = closing?.status === "lukket";

  // ---------- Regn ut planlagt vs. faktisk pr. vakt ----------
  type Beregnet = {
    rad: Rad;
    inn: string | null;
    ut: string | null;
    overtid: number | null; // ut minus planlagt slutt
    stemplet: boolean;
    ferdig: boolean;
    kommentar: string | null;
    sjaforNavn: string;
  };

  const beregnet: Beregnet[] = rader.map((rad) => {
    const te = forste(rad.time_entry);
    const inn = te?.check_in ?? null;
    const ut = te?.check_out ?? null;
    const stemplingsSjafor = forste(te?.driver);
    const planlagtSjafor = forste(rad.driver);
    return {
      rad,
      inn,
      ut,
      overtid: diffMin(rad.planned_end, ut),
      stemplet: !!inn,
      ferdig: !!ut,
      kommentar: te?.comment ?? null,
      sjaforNavn:
        stemplingsSjafor?.full_name ?? planlagtSjafor?.full_name ?? "–",
    };
  });

  const antall = beregnet.length;
  const antStemplet = beregnet.filter((b) => b.stemplet).length;
  const antFerdig = beregnet.filter((b) => b.ferdig).length;
  const totalOvertid = beregnet.reduce(
    (sum, b) => sum + (b.overtid && b.overtid > 0 ? b.overtid : 0),
    0,
  );

  const stats = [
    { label: "Vakter", verdi: String(antall) },
    { label: "Stemplet inn", verdi: `${antStemplet} / ${antall}` },
    { label: "Ferdig (ut)", verdi: `${antFerdig} / ${antall}` },
    { label: "Sum overtid", verdi: visMinutter(totalOvertid || 0) },
  ];

  const erIDag = valgtDato === iDagOslo();

  return (
    <div className="px-[38px] py-[30px]">
      {/* ---------- Topp ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
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
            Kontroll
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Planlagt vs. faktisk, og lukking av dagen.
          </p>
        </div>

        {/* Datovelger: forrige / i dag / neste */}
        <div className="flex items-center gap-2">
          <DatoKnapp href={`/kontroll?dato=${skiftDato(valgtDato, -1)}`} tekst="‹ Forrige" />
          {!erIDag && <DatoKnapp href="/kontroll" tekst="I dag" />}
          <DatoKnapp href={`/kontroll?dato=${skiftDato(valgtDato, 1)}`} tekst="Neste ›" />
        </div>
      </div>

      <p className="mt-4 text-[15px] font-medium">{datoLabel(valgtDato)}</p>

      {/* ---------- Lukk/gjenaapne dag ---------- */}
      <KontrollPanel
        dato={valgtDato}
        erLukket={erLukket}
        lukketAv={closing?.closed_by_name ?? null}
        lukketTid={closing?.closed_at ? klokke(closing.closed_at) : null}
        notat={closing?.note ?? null}
      />

      {/* ---------- Nokkeltall ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 shadow-sm"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {s.label}
            </p>
            <p className="mt-1 text-[26px] font-medium tracking-tight">{s.verdi}</p>
          </div>
        ))}
      </div>

      {error && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente vakter: {error.message}
        </p>
      )}

      {/* ---------- Tabell: planlagt vs. faktisk ---------- */}
      <div
        className="mt-6 overflow-hidden rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {beregnet.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen vakter denne dagen. Vakter genereres fra rutene i{" "}
              <strong>Rutemaster</strong>.
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
                <th className="px-4 py-3 font-semibold">Bil</th>
                <th className="px-4 py-3 font-semibold">Sjåfør</th>
                <th className="px-4 py-3 font-semibold">Planlagt</th>
                <th className="px-4 py-3 font-semibold">Faktisk</th>
                <th className="px-4 py-3 font-semibold">Overtid</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {beregnet.map((b) => {
                const rute = forste(b.rad.route);
                const bil = forste(b.rad.vehicle);
                return (
                  <tr
                    key={b.rad.id}
                    className="border-t align-top text-[14px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{rute?.name ?? "–"}</div>
                      {rute?.route_number && (
                        <div
                          className="text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          Rute {rute.route_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {bil ? (
                        <>
                          <div
                            style={{ fontFamily: "var(--font-dm-mono)" }}
                          >
                            {bil.reg_number}
                          </div>
                          <div
                            className="text-[12.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {bil.make} {bil.model}
                          </div>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3">{b.sjaforNavn}</td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {klokke(b.rad.planned_start)} – {klokke(b.rad.planned_end)}
                    </td>
                    <td className="px-4 py-3" style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {klokke(b.inn)} – {klokke(b.ut)}
                    </td>
                    <td className="px-4 py-3">
                      <OvertidMerke min={b.overtid} ferdig={b.ferdig} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusMerke stemplet={b.stemplet} ferdig={b.ferdig} />
                      {b.kommentar && (
                        <div
                          className="mt-1 max-w-[220px] text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {b.kommentar}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Revisjonslogg ---------- */}
      {logg.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-[15px] font-semibold">Revisjonslogg</h2>
          <div
            className="overflow-hidden rounded-2xl shadow-sm"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <ul>
              {logg.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between border-t px-4 py-2.5 text-[13.5px] first:border-t-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span>
                    <strong>{l.actor_name ?? "Ukjent"}</strong>{" "}
                    {l.action === "lukket" ? "lukket dagen" : "gjenåpnet dagen"}
                  </span>
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-dm-mono)",
                    }}
                  >
                    {new Intl.DateTimeFormat("nb-NO", {
                      timeZone: "Europe/Oslo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(l.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function DatoKnapp({ href, tekst }: { href: string; tekst: string }) {
  return (
    <Link
      href={href}
      className="h-[38px] rounded-[10px] px-3 text-[13.5px] font-medium leading-[38px]"
      style={{
        border: "1.5px solid var(--border-input)",
        color: "var(--foreground)",
      }}
    >
      {tekst}
    </Link>
  );
}

function StatusMerke({ stemplet, ferdig }: { stemplet: boolean; ferdig: boolean }) {
  const { tekst, bg, fg, prikk } = ferdig
    ? { tekst: "Ferdig", bg: "var(--green-soft)", fg: "var(--bring-green-mid)", prikk: "var(--bring-green-mid)" }
    : stemplet
      ? { tekst: "Pågår", bg: "#FFF4D6", fg: "#7A5B00", prikk: "#C99A00" }
      : { tekst: "Ikke stemplet", bg: "#F1F0ED", fg: "#6E6E6E", prikk: "#A8A49C" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: prikk }}
      />
      {tekst}
    </span>
  );
}

function OvertidMerke({ min, ferdig }: { min: number | null; ferdig: boolean }) {
  if (!ferdig || min === null) {
    return <span style={{ color: "var(--text-tertiary)" }}>–</span>;
  }
  // Overtid (positivt) markeres, tidlig ferdig (negativt) er noytralt.
  const overtid = min > 0;
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium"
      style={
        overtid
          ? { backgroundColor: "#FCE5E2", color: "#7A1410" }
          : { backgroundColor: "var(--background)", color: "var(--text-secondary)" }
      }
    >
      {visMinutter(min)}
    </span>
  );
}
