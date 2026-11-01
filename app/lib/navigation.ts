/** Only internal paths are accepted as a return target. */
export function safeFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
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
