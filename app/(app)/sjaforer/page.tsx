import { createClient } from "@/lib/supabase/server";
import NySjafor from "./NySjafor";

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_class: string | null;
  employed_year: number | null;
  status: string;
};

export default async function SjaforerPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("driver")
    .select("id, full_name, phone, email, license_class, employed_year, status")
    .order("created_at", { ascending: false });

  const sjaforer = (data ?? []) as Driver[];

  const aktive = sjaforer.filter((s) => s.status === "aktiv").length;
  const stats = [
    { label: "Sjåfører totalt", verdi: sjaforer.length },
    { label: "Aktive", verdi: aktive },
    { label: "Inaktive", verdi: sjaforer.length - aktive },
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
            Sjåfører
          </h1>
        </div>
        <NySjafor />
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
          Kunne ikke hente sjåfører: {error.message}
        </p>
      )}

      <div
        className="mt-6 overflow-hidden rounded-2xl shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {sjaforer.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ingen sjåfører ennå. Trykk <strong>Ny sjåfør</strong> for å legge
              inn den første.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr
                className="text-[12px] uppercase tracking-wide"
                style={{ color: "var(--text-tertiary)", backgroundColor: "#FBFBFA" }}
              >
                <th className="px-4 py-3 font-semibold">Sjåfør</th>
                <th className="px-4 py-3 font-semibold">Kontakt</th>
                <th className="px-4 py-3 font-semibold">Førerkort</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {sjaforer.map((s) => {
                const aktiv = s.status === "aktiv";
                return (
                  <tr
                    key={s.id}
                    className="border-t text-[14px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{
                            backgroundColor: aktiv
                              ? "var(--bring-green)"
                              : "#A8A49C",
                          }}
                        >
                          {s.full_name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium">{s.full_name}</div>
                          {s.employed_year && (
                            <div
                              className="text-[12.5px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              Ansatt {s.employed_year}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ fontFamily: "var(--font-dm-mono)" }}>
                        {s.phone ?? "–"}
                      </div>
                      <div
                        className="text-[12.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {s.email ?? "–"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.license_class ? (
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                          style={{
                            backgroundColor: "var(--background)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Klasse {s.license_class}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                        style={
                          aktiv
                            ? {
                                backgroundColor: "var(--green-soft)",
                                color: "var(--bring-green-mid)",
                              }
                            : { backgroundColor: "#F1F0ED", color: "#6E6E6E" }
                        }
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: aktiv
                              ? "var(--bring-green-mid)"
                              : "#A8A49C",
                          }}
                        />
                        {aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
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
