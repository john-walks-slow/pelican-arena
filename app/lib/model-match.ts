import type { CatalogEntry } from "./catalog";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Maps a raw API model id from a log (e.g. "claude-opus-4-5-20251101") to the
 * catalog entry whose name it starts with ("Claude Opus 4.5"), preferring the
 * longest match so "GPT-5.1 Codex" wins over "GPT-5.1".
 */
export function matchModel(rawId: string, models: CatalogEntry[]): CatalogEntry | null {
  const target = squash(rawId.split("/").pop() ?? rawId);
  let best: CatalogEntry | null = null;
  let bestLength = 0;
  for (const model of models) {
    const key = squash(model.name);
    if (key.length > bestLength && target.startsWith(key)) {
      best = model;
      bestLength = key.length;
    }
  }
  return best;
}
