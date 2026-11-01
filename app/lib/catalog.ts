export type CatalogKind = "models" | "providers" | "harnesses" | "mods";

export interface CatalogEntry {
  id: string;
  name: string;
}

export type Catalog = Record<CatalogKind, CatalogEntry[]>;

/** A submission named a catalog entry that does not exist or was not selectable. */
export class CatalogError extends Error {}
