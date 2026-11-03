import type { ModelCost } from "./cost";

export type CatalogKind = "models" | "providers" | "harnesses" | "mods";

export interface CatalogEntry {
  id: string;
  name: string;
  /** Models only: effort levels advertised by the source; null when unknown. */
  reasoning?: string[] | null;
  /** Models only: USD pricing rates; null or undefined when unknown. */
  cost?: ModelCost | null;
}

export type Catalog = Record<CatalogKind, CatalogEntry[]>;
