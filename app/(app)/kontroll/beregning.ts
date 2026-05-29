// Rene hjelpefunksjoner for kontroll-skjermen. Ingen "use client"/"use server"
// her, slik at bade server (page/actions) og klient kan bruke dem.

// Hvor mye over planlagt sluttid som godtas for det regnes som "overtid".
export const GRACE_MIN = 15;

// Differanse i minutter mellom to tidspunkt (b - a). Null hvis noe mangler.
export function diffMin(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

// Viser et minutt-tall som varighet: "6 t 30 min", "5 t" eller "45 min".
export function varighet(min: number | null): string {
  if (min === null) return "–";
  const a = Math.abs(min);
  const t = Math.floor(a / 60);
  const m = a % 60;
  if (t > 0 && m > 0) return `${t} t ${m} min`;
  if (t > 0) return `${t} t`;
  return `${m} min`;
}

// Flytter en "YYYY-MM-DD"-dato et antall dager frem/tilbake.
export function skiftDato(d: string, dager: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + dager);
  return dt.toISOString().slice(0, 10);
}

export type VaktStatus = "ikke_stemplet" | "pagar" | "planlagt" | "overtid";

// Avgjor statusmerket pr. vakt ut fra stempling + overtid.
export function vaktStatus(
  stemplet: boolean,
  ferdig: boolean,
  overtidMin: number | null,
): VaktStatus {
  if (!stemplet) return "ikke_stemplet";
  if (!ferdig) return "pagar";
  if (overtidMin !== null && overtidMin > GRACE_MIN) return "overtid";
  return "planlagt";
}
