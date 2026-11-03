interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const MAX_ENTRIES = 40;
const FRESH_MS = 4_000;
const DEFAULT_TTL_MS = 25_000;

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const isBrowser = typeof window !== "undefined" || process.env.NODE_ENV === "test";

export function routeCacheKey(urlLike: string) {
  const url = new URL(urlLike, typeof window !== "undefined" ? window.location.origin : "http://local");
  return `${url.pathname}${url.search}`;
}

export function primeRouteCache<T>(pathnameAndSearch: string, data: T) {
  if (!isBrowser) return;
  const key = routeCacheKey(pathnameAndSearch);
  if (!store.has(key)) {
    evictIfNeeded();
    store.set(key, { data, timestamp: Date.now() });
  }
}

export function updateRouteCache<T>(
  pathnameAndSearch: string,
  updater: (prev: T) => T,
) {
  if (!isBrowser) return;
  const key = routeCacheKey(pathnameAndSearch);
  const entry = store.get(key);
  if (entry) {
    entry.data = updater(entry.data as T);
    entry.timestamp = Date.now();
  }
}

export function clearRouteCache() {
  store.clear();
  inflight.clear();
}

function evictIfNeeded() {
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Merges fresh server data (usually page 1) with existing cached data that may
 * contain multiple appended pages from infinite scroll.
 */
export function mergeCachedData<T>(existing: T, fresh: T): T {
  if (
    !existing ||
    typeof existing !== "object" ||
    !fresh ||
    typeof fresh !== "object"
  ) {
    return fresh;
  }
  return mergeObject(
    existing as Record<string, unknown>,
    fresh as Record<string, unknown>,
  ) as T;
}

function mergeObject(
  existing: Record<string, unknown>,
  fresh: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...fresh };
  for (const [key, value] of Object.entries(existing)) {
    const freshVal = fresh[key];
    if (Array.isArray(value) && Array.isArray(freshVal)) {
      if (value.length > freshVal.length) {
        const freshIds = new Set(
          freshVal
            .map((item) =>
              item && typeof item === "object" && "id" in item
                ? (item as { id: unknown }).id
                : null,
            )
            .filter((id): id is string | number => id != null),
        );
        const remaining = value.filter((item) => {
          const id =
            item && typeof item === "object" && "id" in item
              ? (item as { id: unknown }).id
              : null;
          return id != null ? !freshIds.has(id as string | number) : true;
        });
        result[key] = [...freshVal, ...remaining];
        if ("nextPage" in existing) {
          result.nextPage = existing.nextPage;
        }
      }
    } else if (
      value &&
      typeof value === "object" &&
      freshVal &&
      typeof freshVal === "object" &&
      !Array.isArray(value) &&
      !Array.isArray(freshVal)
    ) {
      result[key] = mergeObject(
        value as Record<string, unknown>,
        freshVal as Record<string, unknown>,
      );
    }
  }
  return result;
}

/**
 * Instant client-side SWR loader cache:
 * - Hit: returns immediately in 0ms without hitting the network, ensuring
 *   instant page transition and scroll restoration with full height intact.
 *   If older than FRESH_MS, refreshes silently in background and merges.
 * - Miss: deduplicates concurrent requests, fetches from server, and populates the cache.
 */
export function cachedClientLoader<T>(
  request: Request,
  serverLoader: () => Promise<T>,
  _ttlMs = DEFAULT_TTL_MS,
): T | Promise<T> {
  const key = routeCacheKey(request.url);
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;

  if (hit) {
    if (now - hit.timestamp >= FRESH_MS && !inflight.has(key)) {
      const refresh = serverLoader()
        .then((fresh) => {
          const merged = mergeCachedData(hit.data, fresh);
          store.set(key, { data: merged, timestamp: Date.now() });
          return merged;
        })
        .catch(() => hit.data)
        .finally(() => inflight.delete(key));
      inflight.set(key, refresh);
    }
    return hit.data;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const task = serverLoader()
    .then((fresh) => {
      evictIfNeeded();
      store.set(key, { data: fresh, timestamp: Date.now() });
      return fresh;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}
