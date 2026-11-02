export type CatalogKind = "models" | "providers" | "harnesses" | "mods";

export interface CatalogEntry {
  id: string;
  name: string;
  /** Models only: effort levels advertised by the source; null when unknown. */
  reasoning?: string[] | null;
}

export type Catalog = Record<CatalogKind, CatalogEntry[]>;
