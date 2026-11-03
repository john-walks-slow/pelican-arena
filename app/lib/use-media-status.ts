import { useCallback, useEffect, useState } from "react";
import type { MediaStatus } from "./preview-state";

/**
 * Tracks whether a media element (image or iframe) has finished loading.
 *
 * The element itself is the source of truth: attaching the ref re-reads the
 * element's real state, so markup that finished before hydration, cache hits,
 * and remounts all resolve without relying on an event that may never fire.
 */
export function useMediaStatus(src: string | null | undefined, timeoutMs = 8000) {
  const [state, setState] = useState<{ src: string | null; status: MediaStatus }>({
    src: src ?? null,
    status: src ? "loading" : "idle",
  });

  // Adjust the tracked source during render so a new src is never reported as
  // the previous one's outcome.
  if (state.src !== (src ?? null)) {
    setState({ src: src ?? null, status: src ? "loading" : "idle" });
  }

  useEffect(() => {
    if (state.status !== "loading") return;
    const timer = setTimeout(() => {
      setState((current) =>
        current.status === "loading" ? { ...current, status: "error" } : current,
      );
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [state.status, state.src, timeoutMs]);

  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !src) return;
      if (element instanceof HTMLImageElement) {
        if (!element.complete) {
          setState({ src, status: "loading" });
          return;
        }
        setState({ src, status: element.naturalWidth > 0 ? "ready" : "error" });
        return;
      }
      // A freshly mounted frame has not fired its `load` yet.
      setState({ src, status: "loading" });
    },
    [src],
  );

  const onLoad = useCallback(() => {
    if (src) setState({ src, status: "ready" });
  }, [src]);

  const onError = useCallback(() => {
    if (src) setState({ src, status: "error" });
  }, [src]);

  return { status: state.status, ref, handlers: { onLoad, onError } };
}
