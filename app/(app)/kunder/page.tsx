import { createClient } from "@/lib/supabase/server";
import NyKunde from "./NyKunde";

type Customer = {
  id: string;
  name: string;
  customer_number: string | null;
  parent_customer_id: string | null;
  created_at: string;
};

const dato = (s: string) =>
  new Intl.DateTimeFormat("nb-NO").format(new Date(s));

export default async function KunderPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer")
    .select("id, name, customer_number, parent_customer_id, created_at")
    .order("created_at", { ascending: false });

  const kunder = (data ?? []) as Customer[];

  // Slå opp navn på overordnet kunde (samlenavn) ut fra id.
  const navnFor = new Map(kunder.map((k) => [k.id, k.name]));
  const samlekunder = new Set(
    kunder.map((k) => k.parent_customer_id).filter(Boolean) as string[],
  );

  const stats = [
    { label: "Kunder totalt", verdi: kunder.length },
    { label: "Samlekunder", verdi: samlekunder.size },
  ];

  // Til nedtrekksvalget i skjemaet: alle kunder kan være overordnet kunde.
  const kundeValg = kunder.map((k) => ({ id: k.id, name: k.name }));

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
            Kunder
          </h1>
        </div>
        <NyKunde kunder={kundeValg} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
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
          Kunne ikke hente kunder: {error.message}
        </p>
      )}

      <div
        className="mt-6 overflow-hidden rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {kunder.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen kunder ennå. Trykk <strong>Ny kunde</strong> for å legge inn
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
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold">Kundenummer</th>
                <th className="px-4 py-3 font-semibold">Samlenavn</th>
                <th className="px-4 py-3 font-semibold">Opprettet</th>
              </tr>
            </thead>
            <tbody>
              {kunder.map((k) => (
                <tr
                  key={k.id}
                  className="border-t text-[14px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3">
                    <span style={{ fontFamily: "var(--font-dm-mono)" }}>
                      {k.customer_number ?? "–"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {k.parent_customer_id
                      ? navnFor.get(k.parent_customer_id) ?? "–"
                      : "–"}
                  </td>
                  <td className="px-4 py-3">{dato(k.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
