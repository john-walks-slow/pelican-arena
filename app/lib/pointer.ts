/**
 * Touch-first devices open the on-screen keyboard when a field receives focus.
 * Check this before focusing anything programmatically.
 */
export function hasCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}
