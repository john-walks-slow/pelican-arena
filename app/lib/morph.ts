import { useEffect, useState } from "react";

let enabled = true;

/** Whether the next navigation should connect a card to its detail panel. */
export function setMorphEnabled(next: boolean) {
  enabled = next;
}

export function isMorphEnabled() {
  return enabled;
}

/**
 * Card morphs need both screens to share a view-transition name. Off-screen
 * cards are not worth snapshotting, and a long scrolled page is the one case
 * where the page itself must hand over to a plain entrance.
 */
export function useMorphEnabled() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 8);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return enabled && !scrolled;
}
