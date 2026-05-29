import { createClient } from "@/lib/supabase/server";
import KontrollView, { type Vakt } from "./KontrollView";
import { diffMin, skiftDato, varighet, vaktStatus } from "./beregning";

// ---------- Hjelpere for dato/tid (alt vises i norsk tid) ----------

function iDagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

// Initialer fra navn: "Henrik Dal" -> "HD".
function initialer(navn: string): string {
  const deler = navn.trim().split(/\s+/).filter(Boolean);
  const a = deler[0]?.[0] ?? "";
  const b = deler.length > 1 ? (deler[deler.length - 1][0] ?? "") : "";
  return (a + b).toUpperCase() || "?";
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
  route:
    | { name: string | null; route_number: string | null }
    | { name: string | null; route_number: string | null }[]
    | null;
  vehicle:
    | { reg_number: string; make: string; model: string }
    | { reg_number: string; make: string; model: string }[]
    | null;
  driver: { full_name: string } | { full_name: string }[] | null;
  time_entry:
    | {
        check_in: string | null;
        check_out: string | null;
        comment: string | null;
        driver: { full_name: string } | { full_name: string }[] | null;
      }[]
    | null;
  vehicle_check: { status: string }[] | null;
  shift_review:
    | { status: string; reviewed_by_name: string | null; reviewed_at: string }[]
    | null;
};

export default async function KontrollPage({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string }>;
}) {
  const sp = await searchParams;
  const iDag = iDagOslo();
  const igar = skiftDato(iDag, -1);
  // Standard: gaarsdagens vakter (det er som regel den dagen man kontrollerer).
  const valgtDato =
    sp.dato && /^\d{4}-\d{2}-\d{2}$/.test(sp.dato) ? sp.dato : igar;

  const supabase = await createClient();

  const { data: shiftData, error } = await supabase
    .from("shift")
    .select(
      `
      id, planned_start, planned_end,
      route:route_id ( name, route_number ),
      vehicle:vehicle_id ( reg_number, make, model ),
      driver:driver_id ( full_name ),
      time_entry ( check_in, check_out, comment, driver:driver_id ( full_name ) ),
      vehicle_check ( status ),
      shift_review ( status, reviewed_by_name, reviewed_at )
    `,
    )
    .eq("date", valgtDato)
    .order("planned_start", { ascending: true });

  const rader = (shiftData ?? []) as Rad[];

  // Felles skala for tidslinje-stolpene = lengste faktiske (eller planlagte) tid.
  const minutter = rader.flatMap((r) => {
    const te = forste(r.time_entry);
    return [
      diffMin(r.planned_start, r.planned_end) ?? 0,
      diffMin(te?.check_in ?? null, te?.check_out ?? null) ?? 0,
    ];
  });
  const skala = Math.max(1, ...minutter);

  const vakter: Vakt[] = rader.map((r) => {
    const te = forste(r.time_entry);
    const rute = forste(r.route);
    const bil = forste(r.vehicle);
    const stemplingsSjafor = forste(te?.driver);
    const planlagtSjafor = forste(r.driver);
    const review = forste(r.shift_review);

    const inn = te?.check_in ?? null;
    const ut = te?.check_out ?? null;
    const planMin = diffMin(r.planned_start, r.planned_end);
    const faktiskMin = diffMin(inn, ut);
    const overtidMin = diffMin(r.planned_end, ut);
    const stemplet = !!inn;
    const ferdig = !!ut;
    const status = vaktStatus(stemplet, ferdig, overtidMin);

    const navn =
      stemplingsSjafor?.full_name ?? planlagtSjafor?.full_name ?? "Ukjent";

    // Stolpe: gronn = arbeidet inntil planlagt, gul = overtid utover planlagt.
    const gronnMin = ferdig
      ? Math.min(planMin ?? 0, faktiskMin ?? 0)
      : (planMin ?? 0);
    const gulMin = ferdig && overtidMin && overtidMin > 0 ? overtidMin : 0;

    const harBilavvik = (r.vehicle_check ?? []).some((v) => v.status === "avvik");

    return {
      id: r.id,
      initialer: initialer(navn),
      sjafor: navn,
      ruteNr: rute?.route_number ?? null,
      ruteNavn: rute?.name ?? "Ukjent rute",
      reg: bil?.reg_number ?? null,
      planRange: `${klokke(r.planned_start)}–${klokke(r.planned_end)}`,
      planVar: varighet(planMin),
      faktiskRange: `${klokke(inn)}–${klokke(ut)}`,
      faktiskVar: varighet(faktiskMin),
      status,
      overtidTekst: status === "overtid" ? varighet(overtidMin) : null,
      gronnPct: Math.round((gronnMin / skala) * 100),
      gulPct: Math.round((gulMin / skala) * 100),
      kommentar: te?.comment ?? null,
      harBilavvik,
      review: (review?.status as "godkjent" | "avvist" | undefined) ?? null,
      reviewAv: review?.reviewed_by_name ?? null,
    };
  });

  // ---------- Nokkeltall ----------
  const antall = vakter.length;
  const medOvertid = vakter.filter((v) => v.status === "overtid").length;
  const tilGodkjenning = vakter.filter((v) => v.review === null).length;
  const godkjent = vakter.filter((v) => v.review === "godkjent").length;

  const undertekst =
    valgtDato === iDag
      ? "Dagens vakter"
      : valgtDato === igar
        ? "Gårsdagens vakter"
        : "Vakter";

  const stats = [
    { label: "Vakter", verdi: String(antall), undertekst: "Registrert", uthevet: false },
    {
      label: "Med overtid",
      verdi: String(medOvertid),
      undertekst: "Krever vurdering",
      uthevet: true,
    },
    {
      label: "Til godkjenning",
      verdi: String(tilGodkjenning),
      undertekst: "Ikke behandlet",
      uthevet: false,
    },
    {
      label: "Godkjent",
      verdi: String(godkjent),
      undertekst: `av ${antall} vakter`,
      uthevet: false,
    },
  ];

  return (
    <KontrollView
      dato={valgtDato}
      datoTittel={datoLabel(valgtDato)}
      undertekst={undertekst}
      erIDag={valgtDato === iDag}
      forrigeHref={`/kontroll?dato=${skiftDato(valgtDato, -1)}`}
      nesteHref={`/kontroll?dato=${skiftDato(valgtDato, 1)}`}
      idagHref={`/kontroll?dato=${iDag}`}
      stats={stats}
      vakter={vakter}
      feil={error?.message ?? null}
    />
  );
}
