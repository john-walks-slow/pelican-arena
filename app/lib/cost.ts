import type { LogMeta } from "./session-log";

export interface ModelCost {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

/**
 * Estimates the monetary cost (in USD) of an inference session given token counts
 * and model cost rates (in USD per 1,000,000 tokens).
 *
 * Returns null if cost rates are missing or not specified.
 */
export function estimateCost(
  log: Pick<LogMeta, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">,
  cost?: ModelCost | null,
): number | null {
  if (!cost) return null;
  if (
    cost.input == null &&
    cost.output == null &&
    cost.cache_read == null &&
    cost.cache_write == null
  ) {
    return null;
  }

  const inputCost = ((log.inputTokens ?? 0) * (cost.input ?? 0)) / 1_000_000;
  const outputCost = ((log.outputTokens ?? 0) * (cost.output ?? 0)) / 1_000_000;
  const cacheReadCost = ((log.cacheReadTokens ?? 0) * (cost.cache_read ?? 0)) / 1_000_000;
  const cacheWriteCost = ((log.cacheWriteTokens ?? 0) * (cost.cache_write ?? 0)) / 1_000_000;

  const total = inputCost + outputCost + cacheReadCost + cacheWriteCost;
  return Number.isFinite(total) ? total : null;
}

/**
 * Formats USD cost into a human-readable display string.
 * - 0: "$0.00"
 * - >= $1: "$1.24"
 * - >= $0.01: "$0.042"
 * - >= $0.001: "$0.004"
 * - < $0.001: "< $0.001"
 */
export function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd >= 0.001) return `$${usd.toFixed(4)}`;
  return "< $0.001";
}
