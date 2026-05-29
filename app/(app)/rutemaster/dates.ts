/** Dagens dato (YYYY-MM-DD) i norsk tid. */
export function iDagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ISO-ukenummer for en dato som er forankret kl. 12 UTC (uten tidssone-rot).
function isoUkenummer(torsdagNoonUtc: Date): number {
  const jan1 = Date.UTC(torsdagNoonUtc.getUTCFullYear(), 0, 1);
  const dager = Math.floor((torsdagNoonUtc.getTime() - jan1) / 86400000);
  return Math.floor(dager / 7) + 1;
}

export type UkeData = {
  datoer: string[]; // 7 datoer, mandag → søndag (YYYY-MM-DD)
  ukenummer: number;
  label: string; // f.eks. "26. mai – 1. jun"
  erDenneUken: boolean;
};

/**
 * Datoene (mandag–søndag) for uken som ligger `offset` uker fra denne uken.
 * offset 0 = denne uken, -1 = forrige, 1 = neste.
 */
export function ukeData(offset: number): UkeData {
  const iOslo = iDagOslo();
  const [y, m, d] = iOslo.split("-").map(Number);
  // Forankre kl. 12 UTC for å unngå at sommertid flytter datoen.
  const iDag = new Date(Date.UTC(y, m - 1, d, 12));
  const ukedag = iDag.getUTCDay(); // 0 = søndag, 1 = mandag, …
  const tilMandag = ukedag === 0 ? -6 : 1 - ukedag;
  const mandag = new Date(iDag.getTime() + (tilMandag + offset * 7) * 86400000);

  const datoer: string[] = [];
  for (let i = 0; i < 7; i++) {
    datoer.push(new Date(mandag.getTime() + i * 86400000).toISOString().slice(0, 10));
  }

  const torsdag = new Date(mandag.getTime() + 3 * 86400000);
  const ukenummer = isoUkenummer(torsdag);

  const fmt = (dato: string) =>
    new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${dato}T12:00:00Z`));
  const label = `${fmt(datoer[0])} – ${fmt(datoer[6])}`;

  return { datoer, ukenummer, label, erDenneUken: offset === 0 };
}

/**
 * Skal en rute med gitt intervall kjøres på en bestemt dato?
 * Intervallet regnes mot en fast referanse (antall dager siden epoke), slik
 * at det blir likt fra uke til uke. intervall 1 = hver dag, 7 = ukentlig osv.
 */
export function kjoresPaaDato(dato: string, intervallDager: number): boolean {
  const intervall = intervallDager > 0 ? intervallDager : 1;
  if (intervall === 1) return true;
  const dagNr = Math.floor(Date.parse(`${dato}T12:00:00Z`) / 86400000);
  return dagNr % intervall === 0;
}

/** De neste `antall` datoene (YYYY-MM-DD) regnet fra i dag i norsk tid. */
export function kommendeDatoer(antall: number): string[] {
  const naa = new Date();
  const iOslo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(naa); // "2026-05-30"
  const [y, m, d] = iOslo.split("-").map(Number);
  // Forankre kl. 12 UTC for å unngå at sommertid flytter datoen.
  const base = Date.UTC(y, m - 1, d, 12);
  const ut: string[] = [];
  for (let i = 0; i < antall; i++) {
    ut.push(new Date(base + i * 86400000).toISOString().slice(0, 10));
  }
  return ut;
}
