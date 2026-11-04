/**
 * Single-fetch data requests are served at `<path>.data` (index routes at `/_.data`) and
 * carry a `_routes` query. Returning to one would render the raw turbo-stream payload, so
 * every return target is reduced to the document path it represents.
 */
function documentTarget(target: string): string {
  const url = new URL(target, "http://localhost");
  if (!url.pathname.endsWith(".data")) return target;
  url.pathname = url.pathname === "/_.data" ? "/" : url.pathname.replace(/\.data$/, "");
  url.searchParams.delete("_routes");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Only internal document paths are accepted as a return target. */
export function safeFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  try {
    const dummy = "http://localhost";
    const parsed = new URL(value, dummy);
    if (parsed.origin !== dummy) return null;
    return documentTarget(value);
  } catch {
    return null;
  }
}

/** Appends a return target without dropping an existing query string. */
export function withFrom(path: string, from: string | null | undefined): string {
  const target = safeFrom(from);
  if (!target) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}from=${encodeURIComponent(target)}`;
}

export interface BackTarget {
  label: string;
  to: string;
  /** True when the target came from an explicit `from` parameter. */
  explicit: boolean;
}

export function backTarget(
  from: string | null | undefined,
  fallback: { label: string; to: string },
): BackTarget {
  const target = safeFrom(from);
  if (!target) return { ...fallback, explicit: false };
  const label = target.startsWith("/me")
    ? "我的"
    : target.startsWith("/s/")
      ? "答案"
      : fallback.label;
  return { label, to: target, explicit: true };
}

/** Strips modal sub-routes down to their parent screen identity. */
export function baseScreenKey(pathname: string): string {
  return (
    pathname
      .replace(/^(\/p\/[^/]+)\/submit.*$/, "$1")
      .replace(/^(\/s\/[^/]+)\/edit.*$/, "$1") || "/"
  );
}

