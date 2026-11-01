const positions = new Map<string, number>();

/** Keeps the last scroll offset for each history entry in this tab. */
export function rememberScroll(key: string, y: number) {
  positions.set(key, y);
}

/** The offset to restore for a history entry, if this tab has seen it. */
export function recallScroll(key: string) {
  return positions.get(key) ?? null;
}
