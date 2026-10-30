interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const MAX_ENTRIES = 40;
const FRESH_MS = 4_000;
const DEFAULT_TTL_MS = 25_000;

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function routeCacheKey(urlLike: string) {
  const url = new URL(urlLike, typeof window !== "undefined" ? window.location.origin : "http://local");
  return `${url.pathname}${url.search}`;
}

export function primeRouteCache<T>(pathnameAndSearch: string, data: T) {
  if (typeof window === "undefined") return;
  const key = routeCacheKey(pathnameAndSearch);
  if (!store.has(key)) {
    evictIfNeeded();
    store.set(key, { data, timestamp: Date.now() });
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
 * Instant client-side SWR loader cache:
 * - Fresh hit (< 4s): returns immediately in 0ms without hitting the network.
 * - Warm hit (< 25s): returns immediately in 0ms and refreshes silently in background.
 * - Miss: deduplicates concurrent requests and populates the cache.
 */
export function cachedClientLoader<T>(
  request: Request,
  serverLoader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): T | Promise<T> {
  const key = routeCacheKey(request.url);
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;

  if (hit && now - hit.timestamp < ttlMs) {
    if (now - hit.timestamp >= FRESH_MS && !inflight.has(key)) {
      const refresh = serverLoader()
        .then((fresh) => {
          store.set(key, { data: fresh, timestamp: Date.now() });
          return fresh;
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
