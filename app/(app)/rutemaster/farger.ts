// Fargepalett for vakt-kort i Gantten. Hver kunde får én fast farge.
// solid = strek/prikk/aksent, soft = lys bakgrunn på kortet.
export type Farge = { solid: string; soft: string };

export const PALETT: Farge[] = [
  { solid: "#1B7A3D", soft: "#E6F2EA" }, // grønn
  { solid: "#8B1E1E", soft: "#F6E4E4" }, // mørk rød
  { solid: "#2563EB", soft: "#E5EDFD" }, // blå
  { solid: "#8A6D1A", soft: "#F4EEDD" }, // gull/oliven
  { solid: "#C0344A", soft: "#F9E3E7" }, // rosa-rød
  { solid: "#2E7D6B", soft: "#E3F0EC" }, // teal
  { solid: "#6D28D9", soft: "#EDE7FB" }, // lilla
  { solid: "#C2671A", soft: "#F8EBDD" }, // oransje
];

// Nøytral farge for vakter uten kunde.
export const NOYTRAL: Farge = { solid: "#8A857C", soft: "#F1F0ED" };

/** Lager et oppslag kunde-id → farge ut fra rekkefølgen i listen. */
export function kundeFarger(kundeIder: string[]): Map<string, Farge> {
  return new Map(
    kundeIder.map((id, i) => [id, PALETT[i % PALETT.length]] as const),
  );
}
