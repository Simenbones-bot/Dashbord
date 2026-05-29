"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stempleInn, stempleUt } from "./actions";

export type Valg = { id: string; navn: string };

export type ShiftKort = {
  id: string;
  tittel: string;
  planlagt: string;
  sidemann: boolean;
  innTid: string | null;
  utTid: string | null;
  sjaforId: string | null;
  sjaforNavn: string | null;
  kommentar: string | null;
};

type Status = "ikke" | "inne" | "ferdig";
function statusAv(k: ShiftKort): Status {
  if (k.utTid) return "ferdig";
  if (k.innTid) return "inne";
  return "ikke";
}

const inputStil: React.CSSProperties = {
  border: "1.5px solid var(--border-input)",
  borderRadius: 10,
};

export default function Stemple({
  token,
  kort,
  sjaforer,
}: {
  token: string;
  kort: ShiftKort[];
  sjaforer: Valg[];
}) {
  const router = useRouter();
  const [valgt, setValgt] = useState<ShiftKort | null>(null);
  const [sjafor, setSjafor] = useState("");
  const [kommentar, setKommentar] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  function apne(k: ShiftKort) {
    setValgt(k);
    setSjafor(k.sjaforId ?? "");
    setKommentar(k.kommentar ?? "");
    setFeil(null);
  }
  function lukk() {
    setValgt(null);
    setFeil(null);
  }

  async function inn() {
    if (!valgt) return;
    setLaster(true);
    setFeil(null);
    const res = await stempleInn(token, valgt.id, sjafor, kommentar);
    setLaster(false);
    if (!res.ok) return setFeil(res.feil);
    lukk();
    router.refresh();
  }
  async function ut() {
    if (!valgt) return;
    setLaster(true);
    setFeil(null);
    const res = await stempleUt(token, valgt.id, kommentar);
    setLaster(false);
    if (!res.ok) return setFeil(res.feil);
    lukk();
    router.refresh();
  }

  if (kort.length === 0) {
    return (
      <div
        className="mt-6 rounded-2xl p-8 text-center shadow-sm"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Ingen vakter på denne bilen i dag.
        </p>
      </div>
    );
  }

  const status = valgt ? statusAv(valgt) : "ikke";

  return (
    <>
      <div className="mt-6 space-y-3">
        {kort.map((k) => {
          const s = statusAv(k);
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => apne(k)}
              className="block w-full rounded-2xl p-4 text-left shadow-sm"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">
                    {k.tittel}
                  </div>
                  <div
                    className="mt-1 text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Planlagt {k.planlagt}
                    {k.sidemann ? " · sidemann" : ""}
                  </div>
                </div>
                <StatusMerke status={s} k={k} />
              </div>
            </button>
          );
        })}
      </div>

      {valgt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(17,17,16,0.35)" }}
            onClick={lukk}
          />
          <div
            className="relative w-full max-w-[480px] rounded-t-2xl p-6 shadow-xl sm:rounded-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-medium tracking-tight">
                  {valgt.tittel}
                </h2>
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  Planlagt {valgt.planlagt}
                </p>
              </div>
              <button
                type="button"
                onClick={lukk}
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Lukk
              </button>
            </div>

            {status === "ferdig" ? (
              <div
                className="rounded-[10px] p-4 text-[14px]"
                style={{ backgroundColor: "var(--background)" }}
              >
                <p>
                  <strong>{valgt.sjaforNavn ?? "Sjåfør"}</strong> stemplet{" "}
                  {valgt.innTid}–{valgt.utTid}.
                </p>
                {valgt.kommentar && (
                  <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
                    «{valgt.kommentar}»
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {status === "inne" ? (
                  <p className="text-[14px]">
                    Inne siden <strong>{valgt.innTid}</strong>
                    {valgt.sjaforNavn ? ` (${valgt.sjaforNavn})` : ""}.
                  </p>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Sjåfør</span>
                    <select
                      value={sjafor}
                      onChange={(e) => setSjafor(e.target.value)}
                      className="w-full bg-white px-3 py-3 text-[16px] outline-none"
                      style={inputStil}
                    >
                      <option value="">Velg sjåfør …</option>
                      {sjaforer.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.navn}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Kommentar / avvik (valgfritt)
                  </span>
                  <textarea
                    value={kommentar}
                    onChange={(e) => setKommentar(e.target.value)}
                    rows={3}
                    placeholder="F.eks. forsinket start, skade oppdaget …"
                    className="w-full px-3 py-2.5 text-[16px] outline-none"
                    style={inputStil}
                  />
                </label>

                {feil && (
                  <p
                    className="rounded-[10px] px-3 py-2.5 text-sm"
                    style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
                  >
                    {feil}
                  </p>
                )}

                {status === "ikke" ? (
                  <button
                    type="button"
                    onClick={inn}
                    disabled={laster}
                    className="h-12 w-full rounded-[10px] text-[16px] font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: "var(--bring-green)" }}
                  >
                    {laster ? "Stempler …" : "Stemple inn"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={ut}
                    disabled={laster}
                    className="h-12 w-full rounded-[10px] text-[16px] font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: "#7A1410" }}
                  >
                    {laster ? "Stempler …" : "Stemple ut"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatusMerke({ status, k }: { status: Status; k: ShiftKort }) {
  const stil: Record<Status, React.CSSProperties> = {
    ikke: { backgroundColor: "#F1F0ED", color: "#6E6E6E" },
    inne: { backgroundColor: "var(--green-soft)", color: "var(--bring-green-mid)" },
    ferdig: { backgroundColor: "#E5EDFD", color: "#2647A6" },
  };
  const tekst =
    status === "ferdig"
      ? `${k.innTid}–${k.utTid}`
      : status === "inne"
        ? `Inne ${k.innTid}`
        : "Ikke stemplet";
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={stil[status]}
    >
      {tekst}
    </span>
  );
}
