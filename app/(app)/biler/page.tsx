import { createClient } from "@/lib/supabase/server";
import NyBil from "./NyBil";
import { STATUS_VALG } from "./makes";

type Vehicle = {
  id: string;
  reg_number: string;
  make: string;
  model: string;
  model_year: number | null;
  status: string;
  leasing_cost_monthly: number | null;
  service_cost_yearly: number | null;
  eu_control_date: string | null;
  next_service_date: string | null;
};

const kr = (n: number | null) =>
  n == null ? "–" : "kr " + new Intl.NumberFormat("nb-NO").format(n);

const dato = (s: string | null) =>
  s == null ? "–" : new Intl.DateTimeFormat("nb-NO").format(new Date(s));

const statusTekst = (v: string) =>
  STATUS_VALG.find((s) => s.value === v)?.label ?? v;

function statusStil(v: string): React.CSSProperties {
  if (v === "i_drift")
    return { backgroundColor: "var(--green-soft)", color: "var(--bring-green-mid)" };
  if (v === "pa_verksted")
    return { backgroundColor: "#FFF2D3", color: "#7A5108" };
  return { backgroundColor: "#F1F0ED", color: "#6E6E6E" };
}

export default async function BilerPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle")
    .select(
      "id, reg_number, make, model, model_year, status, leasing_cost_monthly, service_cost_yearly, eu_control_date, next_service_date",
    )
    .order("created_at", { ascending: false });

  const biler = (data ?? []) as Vehicle[];

  const antall = (s: string) => biler.filter((b) => b.status === s).length;
  const stats = [
    { label: "Biler totalt", verdi: biler.length },
    { label: "I drift", verdi: antall("i_drift") },
    { label: "Ledige", verdi: antall("ledig") },
    { label: "På verksted", verdi: antall("pa_verksted") },
  ];

  return (
    <div className="px-[38px] py-[30px]">
      {/* Topplinje */}
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
            Bil Grandmaster
          </h1>
        </div>
        <NyBil />
      </div>

      {/* Statistikk-kort */}
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
            <p
              className="mt-1 text-[28px] font-medium tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              {s.verdi}
            </p>
          </div>
        ))}
      </div>

      {/* Feil ved henting */}
      {error && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente biler: {error.message}
        </p>
      )}

      {/* Tabell */}
      <div
        className="mt-6 overflow-hidden rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {biler.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen biler ennå. Trykk <strong>Ny bil</strong> for å legge inn den
              første.
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
                <Th>Bil</Th>
                <Th>Årsmodell</Th>
                <Th>Status</Th>
                <Th>Leasing/mnd</Th>
                <Th>Servicekost/år</Th>
                <Th>EU-kontroll</Th>
                <Th>Neste service</Th>
              </tr>
            </thead>
            <tbody>
              {biler.map((b) => (
                <tr
                  key={b.id}
                  className="border-t text-[14px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-3">
                    <div
                      className="font-medium"
                      style={{ fontFamily: "var(--font-dm-mono)" }}
                    >
                      {b.reg_number}
                    </div>
                    <div
                      className="text-[12.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {b.make} {b.model}
                    </div>
                  </td>
                  <td className="px-4 py-3">{b.model_year ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                      style={statusStil(b.status)}
                    >
                      {statusTekst(b.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{kr(b.leasing_cost_monthly)}</td>
                  <td className="px-4 py-3">{kr(b.service_cost_yearly)}</td>
                  <td className="px-4 py-3">{dato(b.eu_control_date)}</td>
                  <td className="px-4 py-3">{dato(b.next_service_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}
