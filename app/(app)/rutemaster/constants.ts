// Delte valg-lister for rute-skjemaet og rutemaster-tabellen. Ingen
// "use client"/"use server" her, slik at både server og klient kan importere.

export const RUTE_TYPER = [
  { value: "fast_rute", label: "Fast rute" },
  { value: "ekstra", label: "Ekstraoppdrag" },
] as const;

// Hardkodet liste (god datakvalitet). value = engelsk nøkkel i db,
// label = norsk visningstekst.
export const KJORETOY_KATEGORIER = [
  { value: "liten_varebil_6", label: "Liten varebil 6m³" },
  { value: "stor_varebil_15", label: "Stor varebil 15m³" },
  { value: "skapbil_19", label: "Skapbil 19m³" },
] as const;

export const STANDARD_FARGE = "#5B5BD6";

export function typeLabel(v: string | null): string {
  return RUTE_TYPER.find((t) => t.value === v)?.label ?? "Fast rute";
}

export function kategoriLabel(v: string | null): string {
  return KJORETOY_KATEGORIER.find((k) => k.value === v)?.label ?? "–";
}

// Bemanning: dobbel = krever sidemann (has_co_driver = true).
export function bemanningLabel(harSidemann: boolean): string {
  return harSidemann ? "Dobbel" : "Enkelt";
}
