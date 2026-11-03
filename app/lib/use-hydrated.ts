import { useEffect, useState } from "react";

/**
 * True once React has hydrated. Frames rendered during SSR can finish loading
 * before hydration attaches their listeners, so anything that needs to observe
 * a frame's `load` must wait for the client.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
