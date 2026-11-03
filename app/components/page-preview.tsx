import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PreviewFrame } from "~/components/preview-frame";
import {
  activatePreview,
  clearPreview,
  getActivePreview,
  releasePreview,
  subscribeActivePreview,
} from "~/lib/active-preview";
import { hasCoarsePointer } from "~/lib/pointer";
import { observeVisibility, observeWidth } from "~/lib/preview-observers";
import { warmPreview } from "~/lib/preview-warmup";
import { GRANT_SEGMENT } from "~/lib/sandbox";
import { cn } from "~/lib/utils";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const KNOWN_SCALES_LIMIT = 200;

/** Remembers last measured scale per preview URL so returning to a cached tab renders frame 1 without a blank box flash. */
const knownScales = new Map<string, number>();

function rememberScale(src: string, width: number) {
  if (width <= 0) return;
  knownScales.delete(src);
  knownScales.set(src, width / VIEWPORT_WIDTH);
  if (knownScales.size <= KNOWN_SCALES_LIMIT) return;
  const oldest = knownScales.keys().next().value;
  if (oldest !== undefined) knownScales.delete(oldest);
}

/** Re-renders only the card whose own activation state changed. */
function usePreviewActive(src: string) {
  const subscribe = useCallback((listener: () => void) => subscribeActivePreview(listener), []);
  const getSnapshot = useCallback(() => getActivePreview() === src, [src]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * A submitted page preview that displays a static thumbnail by default and
 * mounts the live interactive frame on hover, or once a finger touches it on
 * a touch screen. Only one card plays a live frame at a time.
 */
export function PagePreview({
  src,
  thumbnailSrc,
  title,
  className,
}: {
  src: string;
  thumbnailSrc?: string;
  title: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [scale, setScale] = useState(() => knownScales.get(src) ?? 0);
  const active = usePreviewActive(src);

  useEffect(() => {
    setCoarsePointer(hasCoarsePointer());
  }, []);

  useEffect(() => {
    return () => clearPreview(src);
  }, [src]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const applyWidth = (width: number) => {
      if (width <= 0) return;
      rememberScale(src, width);
      setScale(width / VIEWPORT_WIDTH);
    };
    applyWidth(box.clientWidth);
    const stopWidth = observeWidth(box, applyWidth);
    const stopVisibility = observeVisibility(box, setVisible);
    return () => {
      stopWidth();
      stopVisibility();
    };
  }, [src]);

  // Warm the preview document shortly before the pointer arrives. A missing
  // frame is now the only reason a card mounts anything, so this stays a hint.
  useEffect(() => {
    if (!visible || coarsePointer || active) return;
    if (src.includes(`/${GRANT_SEGMENT}/`)) return;
    const timer = setTimeout(() => warmPreview(src), 400);
    return () => clearTimeout(timer);
  }, [visible, coarsePointer, active, src]);

  const liveActive = active && visible && scale > 0;

  return (
    <div
      ref={boxRef}
      onMouseEnter={() => {
        if (!coarsePointer) activatePreview(src);
      }}
      onMouseLeave={() => {
        if (!coarsePointer) releasePreview(src);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") activatePreview(src);
      }}
      className={cn("group relative aspect-[16/10] w-full", className)}
    >
      <PreviewFrame
        title={title}
        posterSrc={thumbnailSrc}
        live={
          liveActive
            ? {
                src,
                width: VIEWPORT_WIDTH,
                height: VIEWPORT_HEIGHT,
                scale,
              }
            : null
        }
        className="size-full"
      />
    </div>
  );
}

export function LiveFrame({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <PreviewFrame
      title={title}
      live={{ src, interactive: true, revealOnTimeout: true }}
      emptyLabel="预览不可用"
      className={cn("bg-raised", className)}
    />
  );
}
