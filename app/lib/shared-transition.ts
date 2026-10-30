/**
 * Material You (M3) Container Transform / Shared Element coordination.
 *
 * Coordinates container transformation between list cards and detail views,
 * preventing layout jank or conflicts with directional sliding animations.
 */

let activeCardId: string | null = null;
let currentMode: "expand" | "collapse" | null = null;

export function prepareCardTransition(e: React.MouseEvent<HTMLElement>, id: string) {
  activeCardId = id;
  currentMode = "expand";

  // Stamp the clicked DOM node directly and synchronously so the browser's
  // capture snapshot immediately contains the view-transition-name
  const target = (e.currentTarget.closest<HTMLElement>(".arena-card") || e.currentTarget) as HTMLElement;
  if (target) {
    target.style.viewTransitionName = "shared-card";
  }

  if (typeof document !== "undefined") {
    document.documentElement.dataset.navDir = "shared-expand";
  }
}

export function prepareBackTransition() {
  currentMode = "collapse";
  if (typeof document !== "undefined") {
    document.documentElement.dataset.navDir = "shared-collapse";
  }
}

export function isCardActive(id: string): boolean {
  return activeCardId === id;
}

export function isDetailActive(id: string): boolean {
  return activeCardId === id;
}

export function consumeSharedTransitionMode(): "expand" | "collapse" | null {
  const mode = currentMode;
  currentMode = null;
  return mode;
}

export function clearSharedTransition() {
  activeCardId = null;
  currentMode = null;
}
