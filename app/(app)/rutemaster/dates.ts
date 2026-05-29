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
