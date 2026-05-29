"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { opprettKunde } from "./actions";

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

// Liste over eksisterende kunder som kan velges som "samlenavn" (overordnet kunde).
type KundeValg = { id: string; name: string };

export default function NyKunde({ kunder }: { kunder: KundeValg[] }) {
  const router = useRouter();
  const [apen, setApen] = useState(false);
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  function lukk() {
    setApen(false);
    setFeil(null);
  }

  async function lagre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);

    const fd = new FormData(e.currentTarget);
    const res = await opprettKunde(fd);

    setLaster(false);
    if (!res.ok) {
      setFeil(res.feil);
      return;
    }
    lukk();
    router.refresh(); // oppdater tabellen med den nye kunden
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setApen(true)}
        className="h-[42px] rounded-[10px] px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--bring-green)" }}
      >
        Ny kunde
      </button>

      {apen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Bakteppe */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
            onClick={lukk}
          />
          {/* Skuff */}
          <div
            className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto p-7 shadow-xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                className="text-xl font-medium tracking-tight"
                style={{ color: "var(--bring-green)" }}
              >
                Ny kunde
              </h2>
              <button
                type="button"
                onClick={lukk}
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Lukk
              </button>
            </div>

            <form onSubmit={lagre} className="space-y-4">
              <Felt label="Navn">
                <input
                  name="name"
                  required
                  placeholder="F.eks. Rema 1000 Storo"
                  className="w-full px-3 py-2.5 text-[15px] outline-none"
                  style={inputStil}
                />
              </Felt>

              <Felt label="Kundenummer">
                <input
                  name="customer_number"
                  placeholder="Valgfritt"
                  className="w-full px-3 py-2.5 text-[15px] outline-none"
                  style={inputStil}
                />
              </Felt>

              <Felt label="Samlenavn (overordnet kunde)">
                <select
                  name="parent_customer_id"
                  defaultValue=""
                  className="w-full bg-white px-3 py-2.5 text-[15px] outline-none"
                  style={inputStil}
                >
                  <option value="">Ingen</option>
                  {kunder.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
                <span
                  className="mt-1 block text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Valgfritt. Bruk dette hvis kunden hører til en større kunde
                  (f.eks. en kjede).
                </span>
              </Felt>

              {feil && (
                <p
                  className="rounded-[10px] px-3 py-2.5 text-sm"
                  style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
                >
                  {feil}
                </p>
              )}

              <button
                type="submit"
                disabled={laster}
                className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--bring-green)" }}
              >
                {laster ? "Lagrer …" : "Lagre kunde"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Felt({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
