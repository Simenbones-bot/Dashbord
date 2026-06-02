import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "./AutoRefresh";
import SjaforVelger, { type SjaforValg } from "./SjaforVelger";

// =============================================================
// Dagsoversikt (M4) – tidslinje-Gantt for én dag.
// Hver bil er en rad; vaktene vises som fargede stolper langs klokkeslettene.
// Farge = punktlighet (grå/grønn/gul/rød) iht. CLAUDE.md. Polles hvert minutt.
// =============================================================

// ---------- Typer ----------

// Supabase returnerer en relasjon som ETT objekt (én-til-én, f.eks. time_entry
// som har unique(shift_id)), som en LISTE (én-til-mange) eller som null. Denne
// typen + forste() under håndterer alle tre trygt.
type Rel<T> = T | T[] | null | undefined;

type DriverInfo = { full_name: string };

type TimeEntry = {
  check_in: string | null;
  check_out: string | null;
  comment: string | null;
  driver_id: string | null;
  driver: Rel<DriverInfo>;
};

type VehicleInfo = {
  id: string;
  reg_number: string;
  make: string;
  model: string;
};

type Shift = {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
  has_co_driver: boolean;
  status: string;
  date: string;
  driver_id: string | null;
  co_driver_id: string | null;
  route_id: string | null;
  route: Rel<{ name: string; route_number: string | null }>;
  vehicle: Rel<VehicleInfo>;
  planned_driver: Rel<DriverInfo>;
  planned_co_driver: Rel<DriverInfo>;
  time_entry: Rel<TimeEntry>;
  vehicle_check: Rel<{ status: string; comment: string | null }>;
};

type Farge = "gray" | "green" | "yellow" | "red";

// Henter første/eneste element trygt uansett om relasjonen er objekt, liste
// eller null.
function forste<T>(v: Rel<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// ---------- Dato-hjelpere ----------

// "HH:MM" i norsk tid fra en ISO-timestamp.
function kl(ts: string | null): string {
  if (!ts) return "–";
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

// Klokkeslett som desimaltime i norsk tid (08:30 → 8.5). Brukes til plassering.
function osloTime(ts: string | Date): number {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h + m / 60;
}

// Legg til (eller trekk fra) dager på en "YYYY-MM-DD"-streng.
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

// ---------- Fargestatus pr. vakt ----------

const FARGE: Record<
  Farge,
  { soft: string; accent: string; text: string }
> = {
  gray:   { soft: "#F6F5F2", accent: "#B9B6AE", text: "#6E6E6E" },
  green:  { soft: "#E5F1E9", accent: "#00643a", text: "#00643a" },
  yellow: { soft: "#FFF6E0", accent: "#D4860C", text: "#7A5108" },
  red:    { soft: "#FCE5E2", accent: "#c7261b", text: "#c7261b" },
};

type Status = { farge: Farge; badge: string; sub: string };

// Bestemmer farge + tekst basert på planlagt start vs. innstempling.
//   grå  = før start (eller stemplet inn innen 5 min for tidlig→grønn)
//   grønn = stemplet innen 5 min av planlagt start ("I rute")
//   gul  = 5–10 min forsinket (med eller uten stempling)
//   rød  = >10 min uten stempling ("Krever handling")
function beregnStatus(shift: Shift, now: Date): Status {
  const te = forste(shift.time_entry);

  if (!shift.planned_start) {
    return { farge: "gray", badge: "Planlagt", sub: "Mangler tid" };
  }
  const start = new Date(shift.planned_start);

  if (te?.check_in) {
    const lateMin = Math.round(
      (new Date(te.check_in).getTime() - start.getTime()) / 60_000,
    );
    if (lateMin <= 5) {
      return { farge: "green", badge: "I rute", sub: `Stemplet ${kl(te.check_in)}` };
    }
    return {
      farge: "yellow",
      badge: `Forsinket +${lateMin} min`,
      sub: `Stemplet ${kl(te.check_in)}`,
    };
  }

  // Ikke stemplet ennå.
  const elapsed = (now.getTime() - start.getTime()) / 60_000;
  if (elapsed < 5) {
    return { farge: "gray", badge: "Før start", sub: "Planlagt" };
  }
  if (elapsed <= 10) {
    return {
      farge: "yellow",
      badge: `Forsinket +${Math.round(elapsed)} min`,
      sub: "Ikke stemplet",
    };
  }
  return {
    farge: "red",
    badge: "Krever handling",
    sub: `Ikke stemplet · +${Math.round(elapsed)} min`,
  };
}

// ---------- Tidslinje-mål ----------

const RAD_LABEL = 200; // bredde på bil-kolonnen (px)
const LANE_H = 78; // høyde for en vanlig vakt-boks (px)
const LANE_H_CO = 102; // høyere boks når vakten har sidemann (to nedtrekk)
const LANE_GAP = 6; // luft mellom spor (px)
const boksHoyde = (harSidemann: boolean) => (harSidemann ? LANE_H_CO : LANE_H);

// ---------- Side ----------

export default async function DagsoversiktPage({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const today = new Intl.DateTimeFormat("sv", { timeZone: "Europe/Oslo" }).format(now);

  // Valgt dato fra URL (?dato=YYYY-MM-DD), ellers i dag.
  const sp = await searchParams;
  const valgtDato =
    sp.dato && /^\d{4}-\d{2}-\d{2}$/.test(sp.dato) ? sp.dato : today;
  const erIDag = valgtDato === today;

  // Hent dagens vakter med alt vi trenger i samme spørring.
  const [shiftRes, verkstedRes, sjaforerRes] = await Promise.all([
    supabase
      .from("shift")
      .select(
        `id, planned_start, planned_end, has_co_driver, status, date, driver_id, co_driver_id, route_id,
         route:route_id (name, route_number),
         vehicle:vehicle_id (id, reg_number, make, model),
         planned_driver:driver_id (full_name),
         planned_co_driver:co_driver_id (full_name),
         time_entry (check_in, check_out, comment, driver_id, driver:driver_id (full_name)),
         vehicle_check (status, comment)`,
      )
      .eq("date", valgtDato)
      .order("planned_start", { ascending: true, nullsFirst: false }),
    supabase
      .from("vehicle")
      .select("id", { count: "exact", head: true })
      .eq("status", "pa_verksted"),
    supabase
      .from("driver")
      .select("id, full_name")
      .eq("status", "aktiv")
      .order("full_name"),
  ]);

  const skift = (shiftRes.data ?? []) as unknown as Shift[];
  const error = shiftRes.error;
  const antallVerksted = verkstedRes.count ?? 0;

  // Aktive sjåfører til nedtrekksmenyen (RLS gir bare egne enheter).
  const sjaforValg: SjaforValg[] = (sjaforerRes.data ?? []).map((s) => ({
    id: s.id,
    navn: s.full_name as string,
  }));

  // Fast sjåfør pr. rute (for ★-markering). Egen, feiltolerant spørring slik at
  // dagsoversikten fortsatt virker dersom kolonnen default_driver_id ennå ikke
  // er lagt til (migrasjon 0012 ikke kjørt i Supabase).
  const ruteIder = [...new Set(skift.map((s) => s.route_id).filter(Boolean))] as string[];
  const fastSjaforForRute = new Map<string, string | null>();
  const fastSidemannForRute = new Map<string, string | null>();
  if (ruteIder.length > 0) {
    const { data: ruteData } = await supabase
      .from("route")
      .select("id, default_driver_id, default_co_driver_id")
      .in("id", ruteIder);
    for (const r of ruteData ?? []) {
      fastSjaforForRute.set(r.id as string, (r.default_driver_id as string | null) ?? null);
      fastSidemannForRute.set(
        r.id as string,
        (r.default_co_driver_id as string | null) ?? null,
      );
    }
  }

  // Forhåndsberegn status for hver vakt.
  const statusFor = new Map<string, Status>();
  for (const s of skift) statusFor.set(s.id, beregnStatus(s, now));

  const tell = (f: Farge) =>
    skift.filter((s) => statusFor.get(s.id)?.farge === f).length;
  const startet = skift.filter((s) => forste(s.time_entry)?.check_in).length;

  // ---------- Statistikk-kort ----------
  const stats = [
    {
      label: "Turer i dag",
      verdi: skift.length,
      under: `${startet} startet · ${skift.length - startet} gjenstår`,
      farge: null as Farge | null,
    },
    {
      label: "Forsinket",
      verdi: tell("yellow"),
      under: "5–10 min etter plan",
      farge: "yellow" as Farge,
    },
    {
      label: "Krever handling",
      verdi: tell("red"),
      under: "Over 10 min uten stempling",
      farge: "red" as Farge,
    },
    {
      label: "Biler på verksted",
      verdi: antallVerksted,
      under: "Utenfor drift",
      farge: null as Farge | null,
    },
  ];

  // ---------- Grupper vakter pr. bil ----------
  type Rad = {
    id: string;
    tittel: string;
    undertittel: string;
    sjaforer: string;
    skift: Shift[];
  };
  const radMap = new Map<string, Rad>();
  for (const s of skift) {
    const v = forste(s.vehicle);
    const id = v?.id ?? "UTEN";
    if (!radMap.has(id)) {
      radMap.set(id, {
        id,
        tittel: v?.reg_number ?? "Uten bil",
        undertittel: v ? `${v.make} ${v.model}` : "Ikke tildelt",
        sjaforer: "",
        skift: [],
      });
    }
    radMap.get(id)!.skift.push(s);
  }
  // Samle sjåførnavn pr. bil (stemplet eller planlagt).
  for (const rad of radMap.values()) {
    const navn = new Set<string>();
    for (const s of rad.skift) {
      const te = forste(s.time_entry);
      const n =
        forste(te?.driver)?.full_name ?? forste(s.planned_driver)?.full_name;
      if (n) navn.add(n);
    }
    rad.sjaforer = [...navn].join(" · ");
  }
  const rader = [...radMap.values()].sort((a, b) =>
    a.tittel.localeCompare(b.tittel, "nb"),
  );

  // ---------- Tidsskala (hele døgnet) ----------
  const minH = 0;
  const maxH = 24;
  const totalT = maxH - minH; // 24 timer
  const timePct = 100 / totalT;

  const steg = totalT > 14 ? 2 : 1;
  const timeMerker: number[] = [];
  for (let h = minH; h <= maxH; h += steg) timeMerker.push(h);

  const nowPct = erIDag
    ? Math.min(Math.max((osloTime(now) - minH) * timePct, 0), 100)
    : null;

  const gridBakgrunn = {
    backgroundImage: `repeating-linear-gradient(to right, #F0EFEC 0, #F0EFEC 1px, transparent 1px, transparent ${timePct}%)`,
  };

  // ---------- Topplinje: dato-tekst ----------
  const datoTekst = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(valgtDato + "T12:00:00Z"));
  const datoStor = datoTekst.charAt(0).toUpperCase() + datoTekst.slice(1);

  const lenke = (d: string) => (d === today ? "/dagsoversikt" : `/dagsoversikt?dato=${d}`);

  return (
    <div className="px-[38px] py-[30px]">
      <AutoRefresh />

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
            Dagsoversikt
          </h1>
        </div>

        {/* Dato-navigasjon */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center overflow-hidden rounded-[10px] border"
            style={{ borderColor: "var(--border-input)", backgroundColor: "var(--surface)" }}
          >
            <Link
              href={lenke(addDays(valgtDato, -1))}
              className="flex h-10 w-10 items-center justify-center text-lg"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Forrige dag"
            >
              ‹
            </Link>
            <span
              className="border-x px-4 text-[14px] font-semibold leading-10"
              style={{ borderColor: "var(--border)", minWidth: 210, textAlign: "center" }}
            >
              {datoStor}
            </span>
            <Link
              href={lenke(addDays(valgtDato, 1))}
              className="flex h-10 w-10 items-center justify-center text-lg"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Neste dag"
            >
              ›
            </Link>
          </div>
          <Link
            href="/dagsoversikt"
            className="flex h-10 items-center rounded-[10px] border px-4 text-[14px] font-semibold"
            style={{
              borderColor: erIDag ? "var(--bring-green)" : "var(--border-input)",
              color: erIDag ? "var(--bring-green)" : "var(--text-secondary)",
              backgroundColor: erIDag ? "var(--green-soft)" : "var(--surface)",
            }}
          >
            I dag
          </Link>
        </div>
      </div>

      {/* ---------- Statistikk-kort ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const cfg = s.farge ? FARGE[s.farge] : null;
          const markert = cfg != null && s.verdi > 0;
          return (
            <div
              key={s.label}
              className="rounded-2xl p-4 shadow-sm"
              style={{
                backgroundColor: "var(--surface)",
                border: markert ? `1px solid ${cfg!.accent}33` : "1px solid transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.label}
                </p>
                {markert && s.farge === "red" && (
                  <span style={{ color: cfg!.text }} aria-hidden>
                    ⚠
                  </span>
                )}
              </div>
              <p
                className="mt-1 text-[28px] font-medium tracking-tight"
                style={{ color: markert ? cfg!.text : "var(--foreground)" }}
              >
                {s.verdi}
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {s.under}
              </p>
            </div>
          );
        })}
      </div>

      {error && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente vakter: {error.message}
        </p>
      )}

      {/* ---------- Tidslinje ---------- */}
      <div
        className="mt-6 overflow-x-auto rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div style={{ minWidth: 1000 }}>
          {/* Hode med tidsskala */}
          <div
            className="grid border-b text-[12px]"
            style={{
              gridTemplateColumns: `${RAD_LABEL}px 1fr`,
              borderColor: "var(--border)",
            }}
          >
            <div
              className="px-4 py-3 font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              Bil
            </div>
            <div className="relative h-9">
              {timeMerker.map((h) => (
                <span
                  key={h}
                  className="absolute top-3 -translate-x-1/2 text-[10.5px]"
                  style={{ left: `${(h - minH) * timePct}%`, color: "var(--text-tertiary)" }}
                >
                  {pad(h)}
                </span>
              ))}
              {nowPct != null && (
                <span
                  className="absolute top-0 bottom-0 w-px"
                  style={{ left: `${nowPct}%`, backgroundColor: "#1F1F1D" }}
                />
              )}
            </div>
          </div>

          {/* Rader pr. bil */}
          {rader.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ingen vakter er planlagt for {erIDag ? "i dag" : "denne dagen"}.
              </p>
            </div>
          ) : (
            rader.map((rad) => {
              // Sorter vakter på starttid og fordel på spor ved overlapp.
              const sortert = [...rad.skift].sort(
                (a, b) =>
                  (a.planned_start ? osloTime(a.planned_start) : 0) -
                  (b.planned_start ? osloTime(b.planned_start) : 0),
              );
              const laneEnd: number[] = [];
              const lane = new Map<string, number>();
              for (const s of sortert) {
                const sH = s.planned_start ? osloTime(s.planned_start) : minH;
                const eH = s.planned_end
                  ? osloTime(s.planned_end)
                  : sH + 1;
                let plassert = false;
                for (let i = 0; i < laneEnd.length; i++) {
                  if (sH >= laneEnd[i]) {
                    lane.set(s.id, i);
                    laneEnd[i] = eH;
                    plassert = true;
                    break;
                  }
                }
                if (!plassert) {
                  lane.set(s.id, laneEnd.length);
                  laneEnd.push(eH);
                }
              }
              const antLanes = Math.max(laneEnd.length, 1);
              // Hvert spor er så høyt som den høyeste boksen i sporet (vakter med
              // sidemann er høyere). Topp-posisjon = sum av sporene over + luft.
              const laneHeight: number[] = new Array(antLanes).fill(LANE_H);
              for (const s of sortert) {
                const li = lane.get(s.id) ?? 0;
                laneHeight[li] = Math.max(laneHeight[li], boksHoyde(s.has_co_driver));
              }
              const laneTop: number[] = [];
              let akk = LANE_GAP;
              for (let i = 0; i < antLanes; i++) {
                laneTop[i] = akk;
                akk += laneHeight[i] + LANE_GAP;
              }
              const radHoyde = akk;

              return (
                <div
                  key={rad.id}
                  className="grid border-b"
                  style={{
                    gridTemplateColumns: `${RAD_LABEL}px 1fr`,
                    borderColor: "var(--border)",
                  }}
                >
                  {/* Bil-etikett */}
                  <div className="px-4 py-3">
                    <div
                      className="text-[14px] font-semibold"
                      style={{ fontFamily: "var(--font-dm-mono)" }}
                    >
                      {rad.tittel}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {rad.undertittel}
                    </div>
                    {rad.sjaforer && (
                      <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        {rad.sjaforer}
                      </div>
                    )}
                  </div>

                  {/* Tidslinje-celle */}
                  <div
                    className="relative border-l"
                    style={{ borderColor: "var(--border)", minHeight: radHoyde, ...gridBakgrunn }}
                  >
                    {nowPct != null && (
                      <span
                        className="absolute top-0 bottom-0 z-10 w-px"
                        style={{ left: `${nowPct}%`, backgroundColor: "#1F1F1D" }}
                      />
                    )}

                    {sortert.map((s) => {
                      const st = statusFor.get(s.id)!;
                      const cfg = FARGE[st.farge];
                      const te = forste(s.time_entry);
                      const vc = forste(s.vehicle_check);
                      const rute = forste(s.route);
                      const erAvlyst = s.status === "avlyst";

                      const sH = s.planned_start ? osloTime(s.planned_start) : minH;
                      const eHraw = s.planned_end ? osloTime(s.planned_end) : null;
                      const eH = eHraw ?? sH + 1;
                      const left = Math.max((sH - minH) * timePct, 0);
                      const width = Math.min(Math.max((eH - sH) * timePct, 11), 100 - left);

                      const tid =
                        s.planned_start && s.planned_end
                          ? `${kl(s.planned_start)}–${kl(s.planned_end)}`
                          : kl(s.planned_start);
                      const sjafor =
                        forste(te?.driver)?.full_name ??
                        forste(s.planned_driver)?.full_name ??
                        null;
                      // Faktisk (stemplet) sjåfør vinner over planlagt sjåfør.
                      const valgtSjaforId = te?.driver_id ?? s.driver_id ?? "";
                      const sidemann = forste(s.planned_co_driver)?.full_name ?? null;
                      const valgtSidemannId = s.co_driver_id ?? "";
                      const kommentar = te?.comment ?? vc?.comment ?? null;

                      return (
                        <div
                          key={s.id}
                          className="absolute overflow-hidden rounded-[9px] px-2.5 py-2"
                          style={{
                            top: laneTop[lane.get(s.id) ?? 0],
                            left: `${left}%`,
                            width: `${width}%`,
                            height: boksHoyde(s.has_co_driver),
                            backgroundColor: cfg.soft,
                            borderLeft: `3px solid ${cfg.accent}`,
                            border: `1px solid ${cfg.accent}33`,
                            borderLeftWidth: 3,
                            opacity: erAvlyst ? 0.5 : 1,
                          }}
                          title={`${rute?.name ?? ""}${tid !== "–" ? " · " + tid : ""}${
                            sjafor ? " · " + sjafor : ""
                          }${vc ? " · Bilsjekk: " + (vc.status === "ok" ? "OK" : "Avvik") : ""}${
                            kommentar ? " · " + kommentar : ""
                          }`}
                        >
                          {/* Øverste linje: rutenr + status + tid */}
                          <div className="flex items-center gap-1.5">
                            {rute?.route_number && (
                              <span
                                className="shrink-0 text-[11px] font-bold"
                                style={{ color: cfg.accent }}
                              >
                                {rute.route_number}
                              </span>
                            )}
                            <span
                              className="truncate text-[10.5px] font-semibold"
                              style={{ color: cfg.text }}
                            >
                              {erAvlyst ? "Avlyst" : st.badge}
                            </span>
                            <span
                              className="ml-auto shrink-0 text-[10.5px]"
                              style={{
                                color: "var(--text-tertiary)",
                                fontFamily: "var(--font-dm-mono)",
                              }}
                            >
                              {tid}
                            </span>
                          </div>

                          {/* Rutenavn */}
                          <div className="mt-0.5 truncate text-[13.5px] font-semibold">
                            {rute?.name ?? "—"}
                            {s.has_co_driver && (
                              <span
                                className="ml-1 text-[11px] font-normal"
                                style={{ color: "var(--text-tertiary)" }}
                              >
                                +1
                              </span>
                            )}
                          </div>

                          {/* Sjåfør-velger (nedtrekk) + bilsjekk */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <SjaforVelger
                              shiftId={s.id}
                              valgtId={valgtSjaforId}
                              navn={sjafor}
                              sjaforer={sjaforValg}
                              accent={cfg.accent}
                              fastDriverId={
                                s.route_id
                                  ? fastSjaforForRute.get(s.route_id) ?? null
                                  : null
                              }
                              felt="driver_id"
                            />
                            {vc && (
                              <span
                                className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                                style={
                                  vc.status === "ok"
                                    ? { backgroundColor: "#e5f1e9", color: "#00643a" }
                                    : { backgroundColor: "#FCE5E2", color: "#c7261b" }
                                }
                              >
                                {vc.status === "ok" ? "✓ Sjekk" : "⚠ Avvik"}
                              </span>
                            )}
                          </div>

                          {/* Sidemann-velger – kun når vakten krever to sjåfører */}
                          {s.has_co_driver && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <SjaforVelger
                                shiftId={s.id}
                                valgtId={valgtSidemannId}
                                navn={sidemann}
                                sjaforer={sjaforValg}
                                accent={cfg.accent}
                                fastDriverId={
                                  s.route_id
                                    ? fastSidemannForRute.get(s.route_id) ?? null
                                    : null
                                }
                                felt="co_driver_id"
                                etikett="+1"
                                placeholder="Velg sidemann …"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="mt-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        Oppdateres automatisk hvert minutt. Sist hentet kl.{" "}
        <span style={{ fontFamily: "var(--font-dm-mono)" }}>{kl(now.toISOString())}</span>.
      </p>
    </div>
  );
}
