import { KIND_META, PROMPT_KINDS, type PromptKind } from "./kinds";
import { buildLeaderboard, type Leaderboard } from "./leaderboard";
import { answerCountsByKind, leaderboardData } from "./queries.server";

export interface CachedLeaderboardResult {
  board: Leaderboard;
  kindCounts: Awaited<ReturnType<typeof answerCountsByKind>>;
  answers: number;
}

interface CacheEntry {
  at: number;
  value: CachedLeaderboardResult;
}

/**
 * The fit reads every active answer and rating, and performs iterative matrix
 * calibration. To eliminate CPU spikes and redundant database queries under high
 * concurrency, results are fully pre-calculated and cached per isolate.
 */
const CACHE_TTL_MS = 120_000;
const boardCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<CachedLeaderboardResult>>();

export async function getCachedLeaderboard(
  kind: PromptKind | null,
  forceRefresh = false,
): Promise<CachedLeaderboardResult> {
  const key = kind ?? "all";
  const now = Date.now();
  const hit = boardCache.get(key);

  if (!forceRefresh && hit && now - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }

  // Single-flight deduplication: collapse concurrent cache misses into one computation
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight;
  }

  const computePromise = (async () => {
    try {
      const [data, kindCounts] = await Promise.all([
        leaderboardData(kind),
        answerCountsByKind(),
      ]);
      const board = buildLeaderboard(data);
      const result: CachedLeaderboardResult = {
        board,
        kindCounts,
        answers: data.submissions.length,
      };
      boardCache.set(key, { at: Date.now(), value: result });
      return result;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, computePromise);
  return computePromise;
}

/**
 * Preheats the leaderboard cache for all kinds in parallel.
 * Useful for cron jobs or cold starts.
 */
export async function preheatLeaderboards(): Promise<void> {
  const targets: (PromptKind | null)[] = [null, ...PROMPT_KINDS];
  await Promise.allSettled(targets.map((k) => getCachedLeaderboard(k, true)));
}
