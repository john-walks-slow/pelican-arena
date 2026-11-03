/**
 * Warming the preview document helps the first hover, but one request per
 * visible card turns a gallery scroll into a burst of Worker + D1 traffic.
 * Keep a small shared queue instead.
 */
const MAX_CONCURRENT = 2;
const MAX_QUEUE = 8;
const REVISIT_MS = 10_000;
const WARMED_LIMIT = 200;

const queued = new Set<string>();
const warmedAt = new Map<string, number>();
let running = 0;

function start(src: string) {
  running += 1;
  warmedAt.delete(src);
  warmedAt.set(src, performance.now());
  if (warmedAt.size > WARMED_LIMIT) {
    const oldest = warmedAt.keys().next().value;
    if (oldest !== undefined) warmedAt.delete(oldest);
  }
  fetch(src)
    .catch(() => {})
    .finally(() => {
      running -= 1;
      const next = queued.values().next().value as string | undefined;
      if (next === undefined) return;
      queued.delete(next);
      start(next);
    });
}

export function warmPreview(src: string) {
  if (running >= MAX_CONCURRENT) {
    if (!queued.has(src) && queued.size < MAX_QUEUE) queued.add(src);
    return;
  }
  const last = warmedAt.get(src);
  if (last !== undefined && performance.now() - last < REVISIT_MS) return;
  start(src);
}
