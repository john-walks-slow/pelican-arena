import { useEffect, useState } from "react";
import { PelicanRide } from "./pelican-ride";

/**
 * Shortest time the splash stays up after the boot script runs. On a fast load
 * hydration beats the animation to the finish, and without the hold the splash
 * would flash by before the ride reads as motion.
 */
const MIN_HOLD_MS = 600;

/** Must match the opacity transition on `.boot-screen`. */
const FADE_MS = 200;

/**
 * Covers the server-rendered page until React has hydrated it, so the first
 * screen is never a readable-but-dead page (all scroll effects and clicks are
 * inert until hydration).
 *
 * Visibility is driven by `data-booting` on `<html>`, which the inline boot
 * script sets before the first paint. Without JS that script never runs, the
 * splash stays hidden and the page renders as plain HTML.
 */
export function BootScreen() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const bootAt = Number(root.dataset.bootAt) || 0;
    const elapsed = bootAt ? performance.now() - bootAt : 0;
    let fadeTimer: number | undefined;

    const holdTimer = window.setTimeout(
      () => {
        root.removeAttribute("data-booting");
        delete root.dataset.bootAt;
        fadeTimer = window.setTimeout(() => setBooted(true), FADE_MS);
      },
      Math.max(0, MIN_HOLD_MS - elapsed),
    );

    return () => {
      window.clearTimeout(holdTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  if (booted) return null;

  return (
    <div className="boot-screen">
      <PelicanRide className="boot-bike" viewBox="0 6 32 26" road dust />
      <span role="status" className="sr-only">
        正在加载
      </span>
    </div>
  );
}
