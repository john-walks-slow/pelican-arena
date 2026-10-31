import { useEffect, useState } from "react";
import { PelicanRide } from "./pelican-ride";

/**
 * Shortest time the splash stays up once the page has painted. Hydration
 * normally finishes faster than this; without the hold the splash would only
 * flicker for a frame or two.
 */
const MIN_HOLD_MS = 300;

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
    const timer = window.setTimeout(
      () => {
        document.documentElement.removeAttribute("data-booting");
        setBooted(true);
      },
      Math.max(0, MIN_HOLD_MS - performance.now()),
    );
    return () => window.clearTimeout(timer);
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
