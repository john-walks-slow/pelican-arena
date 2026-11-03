import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";
import { baseScreenKey, isModalPath } from "./navigation";

export interface HistoryEntry {
  key: string;
  pathname: string;
}

// Browser history entries created by client-side navigation in this tab.
// Tracked with pathnames so page-level back buttons can pop across modal dialogs.
let entries: HistoryEntry[] = [];

function findLastKeyIndex(list: HistoryEntry[], key: string): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].key === key) return i;
  }
  return -1;
}

/**
 * Calculates how many steps to pop in browser history to reach the nearest
 * standalone page, skipping overlay modal routes (/p/:id/submit, /s/:id/edit)
 * and redundant entries of the current page.
 * Returns a negative integer (e.g. -1, -2) when a target exists, or null to fall back.
 */
export function getBackDelta(): number | null {
  const currentIndex = entries.length - 1;
  if (currentIndex <= 0) return null;

  const currentEntry = entries[currentIndex];
  const currentBase = baseScreenKey(currentEntry.pathname);
  const currentIsModal = isModalPath(currentEntry.pathname);

  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = entries[i];
    if (isModalPath(candidate.pathname)) continue;
    if (!currentIsModal && baseScreenKey(candidate.pathname) === currentBase) continue;
    return i - currentIndex;
  }

  return null;
}

export function canGoBackInApp(): boolean {
  return getBackDelta() !== null;
}

/** Pure helper used by useTrackNavigationHistory and unit tests. */
export function recordNavigation(
  current: HistoryEntry[],
  next: HistoryEntry,
  navigationType: "POP" | "PUSH" | "REPLACE",
): HistoryEntry[] {
  if (current.length === 0) {
    return [next];
  }

  if (navigationType === "POP") {
    const index = findLastKeyIndex(current, next.key);
    if (index >= 0) {
      const updated = current.slice(0, index + 1);
      updated[index] = next;
      return updated;
    }
    return [next];
  }

  if (navigationType === "REPLACE") {
    const updated = [...current];
    updated[updated.length - 1] = next;
    return updated;
  }

  if (current[current.length - 1]?.key !== next.key) {
    return [...current, next];
  }

  return current;
}

export function useTrackNavigationHistory() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    entries = recordNavigation(
      entries,
      { key: location.key, pathname: location.pathname },
      navigationType,
    );
  }, [location.key, location.pathname, navigationType]);
}

/** Test-only helper to inspect and override navigation stack state. */
export function __setNavigationEntriesForTest(list: HistoryEntry[]) {
  entries = [...list];
}
