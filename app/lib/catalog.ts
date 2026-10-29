export type CatalogKind = "models" | "providers" | "harnesses" | "mods";

export interface CatalogEntry {
  id: string;
  name: string;
}

export type Catalog = Record<CatalogKind, CatalogEntry[]>;
