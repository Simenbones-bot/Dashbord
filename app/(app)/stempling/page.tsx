import { createClient } from "@/lib/supabase/server";
import Stempling, { type ShiftKort, type Valg } from "./Stempling";

// Klokkeslett HH:MM i norsk tid fra et timestamptz.
const klokke = (ts: string | null) =>
  ts
    ? new Intl.DateTimeFormat("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Oslo",
      }).format(new Date(ts))
    : null;

export default async function StemplingPage() {
  const supabase = await createClient();

  // Dagens dato i norsk tid.
  const iDag = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Dagens vakter + oppslagslister.
  const [vakterRes, ruterRes, kunderRes, bilerRes, sjaforerRes] =
    await Promise.all([
      supabase
        .from("shift")
        .select(
          "id, route_id, vehicle_id, planned_start, planned_end, has_co_driver",
        )
        .eq("date", iDag)
        .order("planned_start", { ascending: true }),
      supabase.from("route").select("id, name, route_number, customer_id"),
      supabase.from("customer").select("id, name"),
      supabase.from("vehicle").select("id, reg_number, make, model"),
      supabase
        .from("driver")
        .select("id, full_name")
        .eq("status", "aktiv")
        .order("full_name"),
    ]);

  const vakter = vakterRes.data ?? [];
  const error = vakterRes.error;

  // Stemplinger for dagens vakter.
  const vaktIder = vakter.map((v) => v.id);
  const stemplingerRes = vaktIder.length
    ? await supabase
        .from("time_entry")
        .select("shift_id, driver_id, check_in, check_out, comment")
        .in("shift_id", vaktIder)
    : { data: [] as never[] };

  const ruteInfo = new Map(
    (ruterRes.data ?? []).map((r) => [
      r.id,
      { nummer: r.route_number as string | null, navn: r.name as string, kundeId: r.customer_id as string | null },
    ]),
  );
  const kundeNavn = new Map((kunderRes.data ?? []).map((k) => [k.id, k.name as string]));
  const bilNavn = new Map(
    (bilerRes.data ?? []).map((b) => [b.id, `${b.reg_number} – ${b.make} ${b.model}`]),
  );
  const sjaforNavn = new Map(
    (sjaforerRes.data ?? []).map((s) => [s.id, s.full_name as string]),
  );
  const stemplingFor = new Map(
    (stemplingerRes.data ?? []).map((t) => [t.shift_id, t]),
  );

  const kort: ShiftKort[] = vakter.map((v) => {
    const r = ruteInfo.get(v.route_id);
    const kunde = r?.kundeId ? kundeNavn.get(r.kundeId) ?? null : null;
    const tittelDeler = [r?.nummer, kunde ?? r?.navn].filter(Boolean);
    const t = stemplingFor.get(v.id);
    const planlagt =
      klokke(v.planned_start) || klokke(v.planned_end)
        ? `${klokke(v.planned_start) ?? "?"}–${klokke(v.planned_end) ?? "?"}`
        : "Ingen planlagt tid";
    return {
      id: v.id,
      tittel: tittelDeler.join(" · ") || "Vakt",
      bil: v.vehicle_id ? bilNavn.get(v.vehicle_id) ?? "Ukjent bil" : "Ingen bil",
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
    <div className="mx-auto max-w-[640px] px-4 py-6 sm:px-6">
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-tertiary)" }}
      >
        Drift
      </p>
      <h1
        className="mt-1 text-[28px] font-medium tracking-tight"
        style={{ color: "var(--bring-green)" }}
      >
        Stempling
      </h1>
      <p className="mt-1 text-[14px] capitalize" style={{ color: "var(--text-tertiary)" }}>
        {datoTekst}
      </p>

      {error && (
        <p
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente vakter: {error.message}
        </p>
      )}

      <Stempling kort={kort} sjaforer={sjaforer} />
    </div>
  );
}
