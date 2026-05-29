// Hardkodet liste over bilmerker og modeller (varebiler).
// Holder datakvaliteten hoy: bruker velger fra liste, skriver ikke fritekst.
export const MERKER: Record<string, string[]> = {
  "Volkswagen": ["Caddy", "Transporter", "Crafter"],
  "Mercedes-Benz": ["Citan", "Vito", "Sprinter"],
  "Ford": ["Transit Courier", "Transit Custom", "Transit"],
  "Renault": ["Kangoo", "Trafic", "Master"],
  "Toyota": ["Proace City", "Proace", "Hilux"],
  "Peugeot": ["Partner", "Expert", "Boxer"],
  "Citroën": ["Berlingo", "Jumpy", "Jumper"],
  "Fiat": ["Doblò", "Scudo", "Ducato"],
  "Opel": ["Combo", "Vivaro", "Movano"],
  "Iveco": ["Daily"],
  "Nissan": ["Townstar", "Primastar", "Interstar"],
  "Man": ["TGE"],
};

export const STATUS_VALG = [
  { value: "i_drift", label: "I drift" },
  { value: "ledig", label: "Ledig" },
  { value: "pa_verksted", label: "På verksted" },
] as const;
