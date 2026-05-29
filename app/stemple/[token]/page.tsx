import { createAdminClient } from "@/lib/supabase/admin";
import Stemple, { type ShiftKort, type Valg } from "./Stemple";

const klokke = (ts: string | null) =>
  ts
    ? new Intl.DateTimeFormat("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Oslo",
      }).format(new Date(ts))
    : null;

function Ramme({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

export default async function StemplePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  // Finn bilen ut fra koden.
  const { data: bil } = await admin
    .from("vehicle")
    .select("id, unit_id, reg_number, make, model")
    .eq("stamp_token", token)
    .maybeSingle();

  if (!bil) {
    return (
      <Ramme>
        <h1 className="text-[24px] font-medium" style={{ color: "var(--bring-green)" }}>
          Ugyldig kode
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Denne stemplingslenken er ikke gyldig. Sjekk QR-koden i bilen, eller
          spør lederen din.
        </p>
      </Ramme>
    );
  }

  const iDag = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Dagens vakter for KUN denne bilen.
  const { data: vakter } = await admin
    .from("shift")
    .select("id, route_id, planned_start, planned_end, has_co_driver")
    .eq("vehicle_id", bil.id)
    .eq("date", iDag)
    .order("planned_start", { ascending: true });

  const vaktIder = (vakter ?? []).map((v) => v.id);

  const [ruterRes, kunderRes, sjaforerRes, stemplingerRes] = await Promise.all([
    admin.from("route").select("id, name, route_number, customer_id"),
    admin.from("customer").select("id, name"),
    admin
      .from("driver")
      .select("id, full_name")
      .eq("unit_id", bil.unit_id)
      .eq("status", "aktiv")
      .order("full_name"),
    vaktIder.length
      ? admin
          .from("time_entry")
          .select("shift_id, driver_id, check_in, check_out, comment")
          .in("shift_id", vaktIder)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const ruteInfo = new Map(
    (ruterRes.data ?? []).map((r) => [
      r.id,
      {
        nummer: r.route_number as string | null,
        navn: r.name as string,
        kundeId: r.customer_id as string | null,
      },
    ]),
  );
  const kundeNavn = new Map((kunderRes.data ?? []).map((k) => [k.id, k.name as string]));
  const sjaforNavn = new Map(
    (sjaforerRes.data ?? []).map((s) => [s.id, s.full_name as string]),
  );
  const stemplingFor = new Map(
    (stemplingerRes.data ?? []).map((t) => [t.shift_id, t]),
  );

  const kort: ShiftKort[] = (vakter ?? []).map((v) => {
    const r = ruteInfo.get(v.route_id);
    const kunde = r?.kundeId ? kundeNavn.get(r.kundeId) ?? null : null;
    const t = stemplingFor.get(v.id);
    const planlagt =
      klokke(v.planned_start) || klokke(v.planned_end)
        ? `${klokke(v.planned_start) ?? "?"}–${klokke(v.planned_end) ?? "?"}`
        : "Ingen planlagt tid";
    return {
      id: v.id,
      tittel: [r?.nummer, kunde ?? r?.navn].filter(Boolean).join(" · ") || "Vakt",
      planlagt,
      sidemann: v.has_co_driver,
      innTid: klokke(t?.check_in ?? null),
      utTid: klokke(t?.check_out ?? null),
      sjaforId: t?.driver_id ?? null,
      sjaforNavn: t?.driver_id ? sjaforNavn.get(t.driver_id) ?? null : null,
      kommentar: t?.comment ?? null,
    };
  });

  const sjaforer: Valg[] = (sjaforerRes.data ?? []).map((s) => ({
    id: s.id,
    navn: s.full_name as string,
  }));

  const datoTekst = new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iDag}T12:00:00Z`));

  return (
    <Ramme>
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-tertiary)" }}
      >
        Stempling
      </p>
      <h1
        className="mt-1 text-[26px] font-medium tracking-tight"
        style={{ color: "var(--bring-green)", fontFamily: "var(--font-dm-mono)" }}
      >
        {bil.reg_number}
      </h1>
      <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
        {bil.make} {bil.model}
      </p>
      <p className="mt-1 text-[13px] capitalize" style={{ color: "var(--text-tertiary)" }}>
        {datoTekst}
      </p>

      <Stemple token={token} kort={kort} sjaforer={sjaforer} />
    </Ramme>
  );
}
