"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  godkjennVakt,
  avvisVakt,
  angreVakt,
  godkjennAlleUtenAvvik,
} from "./actions";
import type { VaktStatus } from "./beregning";

export type Vakt = {
  id: string;
  initialer: string;
  sjafor: string;
  ruteNr: string | null;
  ruteNavn: string;
  reg: string | null;
  planRange: string;
  planVar: string;
  faktiskRange: string;
  faktiskVar: string;
  status: VaktStatus;
  overtidTekst: string | null;
  gronnPct: number;
  gulPct: number;
  kommentar: string | null;
  harBilavvik: boolean;
  review: "godkjent" | "avvist" | null;
  reviewAv: string | null;
};

type Stat = {
  label: string;
  verdi: string;
  undertekst: string;
  uthevet: boolean;
};

export default function KontrollView({
  dato,
  datoTittel,
  undertekst,
  erIDag,
  forrigeHref,
  nesteHref,
  idagHref,
  stats,
  vakter,
  feil,
}: {
  dato: string;
  datoTittel: string;
  undertekst: string;
  erIDag: boolean;
  forrigeHref: string;
  nesteHref: string;
  idagHref: string;
  stats: Stat[];
  vakter: Vakt[];
  feil: string | null;
}) {
  const router = useRouter();
  const [laster, setLaster] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  async function kjor(id: string, handling: () => Promise<{ ok: boolean; feil?: string }>) {
    setLaster(id);
    setMelding(null);
    const res = await handling();
    setLaster(null);
    if (!res.ok && res.feil) {
      setMelding(res.feil);
      return;
    }
    router.refresh();
  }

  const antallBehandlet = vakter.filter((v) => v.review !== null).length;

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
          <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span aria-hidden>🗓</span>
            <span>
              {undertekst} · {datoTittel}
            </span>
          </div>
          {/* Datovelger */}
          <div className="mt-3 flex items-center gap-2">
            <DatoKnapp href={forrigeHref} tekst="‹ Forrige" />
            {!erIDag && <DatoKnapp href={idagHref} tekst="I dag" />}
            <DatoKnapp href={nesteHref} tekst="Neste ›" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => kjor("alle", () => godkjennAlleUtenAvvik(dato))}
          disabled={laster !== null || vakter.length === 0}
          className="flex h-[44px] items-center gap-2 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50"
          style={{ border: "1.5px solid var(--border-input)", color: "var(--foreground)" }}
        >
          <span style={{ color: "var(--bring-green)" }}>✓</span>
          {laster === "alle" ? "Godkjenner …" : "Godkjenn alle uten avvik"}
        </button>
      </div>

      {melding && (
        <p
          className="mt-4 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          {melding}
        </p>
      )}

      {/* ---------- Nokkeltall ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 shadow-sm"
            style={{
              backgroundColor: "var(--surface)",
              border: s.uthevet ? "1.5px solid #E6B800" : "1.5px solid transparent",
            }}
          >
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {s.label}
            </p>
            <p className="mt-1 text-[28px] font-medium tracking-tight">{s.verdi}</p>
            <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {s.undertekst}
            </p>
          </div>
        ))}
      </div>

      {feil && (
        <p
          className="mt-6 rounded-[10px] px-4 py-3 text-sm"
          style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
        >
          Kunne ikke hente vakter: {feil}
        </p>
      )}

      {/* ---------- Vaktkort ---------- */}
      {vakter.length === 0 ? (
        <div
          className="mt-6 rounded-2xl p-10 text-center shadow-sm"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Ingen vakter denne dagen. Vakter genereres fra rutene i{" "}
            <strong>Rutemaster</strong>.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {vakter.map((v) => (
            <VaktKort
              key={v.id}
              v={v}
              laster={laster === v.id}
              deaktivert={laster !== null}
              onGodkjenn={() => kjor(v.id, () => godkjennVakt(v.id))}
              onAvvis={() => kjor(v.id, () => avvisVakt(v.id, null))}
              onAngre={() => kjor(v.id, () => angreVakt(v.id))}
            />
          ))}
        </div>
      )}

      {vakter.length > 0 && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          {antallBehandlet} av {vakter.length} vakter behandlet.
        </p>
      )}
    </div>
  );
}

function DatoKnapp({ href, tekst }: { href: string; tekst: string }) {
  return (
    <Link
      href={href}
      className="h-[36px] rounded-[10px] px-3 text-[13px] font-medium leading-[36px]"
      style={{ border: "1.5px solid var(--border-input)", color: "var(--foreground)" }}
    >
      {tekst}
    </Link>
  );
}

function VaktKort({
  v,
  laster,
  deaktivert,
  onGodkjenn,
  onAvvis,
  onAngre,
}: {
  v: Vakt;
  laster: boolean;
  deaktivert: boolean;
  onGodkjenn: () => void;
  onAvvis: () => void;
  onAngre: () => void;
}) {
  const ramme =
    v.review === "godkjent"
      ? "1.5px solid var(--bring-green)"
      : v.review === "avvist"
        ? "1.5px solid #E0A0A0"
        : "1.5px solid var(--border)";

  return (
    <div
      className="rounded-2xl p-5 shadow-sm"
      style={{ backgroundColor: "var(--surface)", border: ramme }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Sjafor + rute */}
        <div className="flex min-w-[210px] items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ backgroundColor: "var(--bring-green)" }}
          >
            {v.initialer}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{v.sjafor}</div>
            <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {v.ruteNr && <span className="font-medium">{v.ruteNr} </span>}
              {v.ruteNavn}
              {v.reg && (
                <span style={{ fontFamily: "var(--font-dm-mono)" }}> · {v.reg}</span>
              )}
            </div>
          </div>
        </div>

        {/* Planlagt */}
        <Tidkolonne tittel="Planlagt" range={v.planRange} varighet={v.planVar} />
        <span style={{ color: "var(--text-tertiary)" }}>›</span>
        {/* Faktisk */}
        <Tidkolonne tittel="Faktisk" range={v.faktiskRange} varighet={v.faktiskVar} />

        {/* Status + knapper */}
        <div className="ml-auto flex items-center gap-3">
          <StatusMerke status={v.status} overtidTekst={v.overtidTekst} />
          {v.review === null ? (
            <>
              <button
                type="button"
                onClick={onGodkjenn}
                disabled={deaktivert}
                className="flex h-[40px] items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--bring-green)" }}
              >
                ✓ {laster ? "…" : "Godkjenn"}
              </button>
              <button
                type="button"
                onClick={onAvvis}
                disabled={deaktivert}
                className="h-[40px] rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50"
                style={{ border: "1.5px solid var(--border-input)", color: "var(--foreground)" }}
              >
                Avvis
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {v.review === "godkjent" ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
                  style={{ backgroundColor: "var(--green-soft)", color: "var(--bring-green-mid)" }}
                >
                  ✓ Godkjent
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
                  style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
                >
                  Avvist
                </span>
              )}
              <button
                type="button"
                onClick={onAngre}
                disabled={deaktivert}
                className="text-[13px] font-medium underline disabled:opacity-50"
                style={{ color: "var(--text-secondary)" }}
              >
                Angre
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tidslinje-stolpe */}
      <div
        className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--background)" }}
      >
        <div style={{ width: `${v.gronnPct}%`, backgroundColor: "var(--bring-green)" }} />
        <div style={{ width: `${v.gulPct}%`, backgroundColor: "#E6B800" }} />
      </div>

      {/* Kommentar / avvik */}
      {(v.kommentar || v.harBilavvik) && (
        <div
          className="mt-3 rounded-[10px] px-3 py-2.5 text-[13.5px]"
          style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}
        >
          {v.harBilavvik && (
            <span
              className="mr-2 inline-block rounded-full px-2 py-0.5 text-[12px] font-medium"
              style={{ backgroundColor: "#FCE5E2", color: "#7A1410" }}
            >
              Bilsjekk: avvik
            </span>
          )}
          {v.kommentar && (
            <>
              <strong>{fornavn(v.sjafor)}:</strong> {v.kommentar}
            </>
          )}
        </div>
      )}

      {v.review !== null && v.reviewAv && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {v.review === "godkjent" ? "Godkjent" : "Avvist"} av {v.reviewAv}
        </p>
      )}
    </div>
  );
}

function Tidkolonne({
  tittel,
  range,
  varighet,
}: {
  tittel: string;
  range: string;
  varighet: string;
}) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-tertiary)" }}
      >
        {tittel}
      </p>
      <p className="font-medium" style={{ fontFamily: "var(--font-dm-mono)" }}>
        {range}
      </p>
      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {varighet}
      </p>
    </div>
  );
}

function StatusMerke({
  status,
  overtidTekst,
}: {
  status: VaktStatus;
  overtidTekst: string | null;
}) {
  const stil: Record<
    VaktStatus,
    { tekst: string; bg: string; fg: string; ikon: string }
  > = {
    overtid: {
      tekst: `Overtid + ${overtidTekst ?? ""}`,
      bg: "#FFF4D6",
      fg: "#7A5B00",
      ikon: "⚠",
    },
    planlagt: { tekst: "Som planlagt", bg: "var(--green-soft)", fg: "var(--bring-green-mid)", ikon: "✓" },
    pagar: { tekst: "Pågår", bg: "#FFF4D6", fg: "#7A5B00", ikon: "•" },
    ikke_stemplet: { tekst: "Ikke stemplet", bg: "#F1F0ED", fg: "#6E6E6E", ikon: "•" },
  };
  const s = stil[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span aria-hidden>{s.ikon}</span>
      {s.tekst}
    </span>
  );
}

function fornavn(navn: string): string {
  return navn.trim().split(/\s+/)[0] ?? navn;
}
