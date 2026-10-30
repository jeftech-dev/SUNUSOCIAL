// Regions and communes of Senegal: the single list shared by Next.js and Convex (DT-22).
//
// INTERIM DATA: the prototype's 8 regions (prototype/SUNUSOCIAL-v2.dc.html). The official list
// of all 14 regions and their communes is pending the board (docs/BOARD_QUESTIONS.md Q3).
// Replacing this object is the only change needed once it arrives.

export const GEO = {
  Dakar: [
    "Dakar-Plateau",
    "Médina",
    "Grand Dakar",
    "Parcelles Assainies",
    "Pikine",
    "Guédiawaye",
    "Keur Massar",
    "Rufisque",
  ],
  Thiès: ["Thiès", "Mbour", "Saly", "Tivaouane", "Joal-Fadiouth"],
  Diourbel: ["Diourbel", "Touba", "Mbacké", "Bambey"],
  "Saint-Louis": ["Saint-Louis", "Richard-Toll", "Dagana", "Podor"],
  Kaolack: ["Kaolack", "Nioro du Rip", "Guinguinéo"],
  Louga: ["Louga", "Kébémer", "Linguère"],
  Ziguinchor: ["Ziguinchor", "Bignona", "Oussouye"],
  Fatick: ["Fatick", "Foundiougne", "Gossas"],
} as const satisfies Record<string, readonly string[]>;

export type Region = keyof typeof GEO;
export type Commune = (typeof GEO)[Region][number];

/** Regions, in display order. */
export const REGIONS = Object.keys(GEO) as Region[];

export function isValidRegion(region: string): region is Region {
  return Object.prototype.hasOwnProperty.call(GEO, region);
}

/** The communes of a region; empty for an unknown region. */
export function communesOf(region: string): readonly string[] {
  return isValidRegion(region) ? GEO[region] : [];
}

/** True when `commune` belongs to `region`. */
export function isValidCommune(region: string, commune: string): boolean {
  return communesOf(region).includes(commune);
}
