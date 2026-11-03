import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { PreviewSkeleton } from "~/components/preview-skeleton";
import { resolvePreviewLayer, type PreviewLayer } from "~/lib/preview-state";
import { SANDBOX } from "~/lib/sandbox";
import { useHydrated } from "~/lib/use-hydrated";
import { useMediaStatus } from "~/lib/use-media-status";
import { cn } from "~/lib/utils";

const SKELETON_DELAY = 120;

export type LiveFrameSpec = {
  src: string;
  /** Scaled card frame: `width`x`height` scaled down to the card width. */
  width?: number;
  height?: number;
  scale?: number;
  interactive?: boolean;
  /** Keep the frame visible after a slow load instead of settling on the empty state. */
  revealOnTimeout?: boolean;
};

type PreviewFrameProps = {
  title: string;
  posterSrc?: string | null;
  posterClassName?: string;
  live?: LiveFrameSpec | null;
  emptyLabel?: string;
  className?: string;
};

/**
 * The shared media stack behind every work preview: thumbnail, live frame, and
 * the transient skeleton between them. What is visible is derived from what
 * each layer actually loaded, never from guesswork about which event fired.
 */
export function PreviewFrame({
  title,
  posterSrc,
  posterClassName,
  live,
  emptyLabel = "暂无预览",
  className,
}: PreviewFrameProps) {
  const hydrated = useHydrated();
  // A frame rendered during SSR can complete before hydration sees its `load`.
  const frame = hydrated ? live : null;

  const poster = useMediaStatus(posterSrc);
  const liveStatus = useMediaStatus(frame?.src, 10_000);

  const layer: PreviewLayer =
    live && !hydrated
      ? "loading"
      : resolvePreviewLayer({
          poster: poster.status,
          liveRequested: Boolean(frame),
          live: liveStatus.status,
        });

  const liveVisible =
    Boolean(frame) &&
    (liveStatus.status === "ready" ||
      Boolean(frame?.revealOnTimeout && liveStatus.status === "error"));

  const [skeletonVisible, setSkeletonVisible] = useState(false);
  useEffect(() => {
    if (layer !== "loading") {
      setSkeletonVisible(false);
      return;
    }
    const timer = setTimeout(() => setSkeletonVisible(true), SKELETON_DELAY);
    return () => clearTimeout(timer);
  }, [layer]);

  const scaled = typeof frame?.scale === "number";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-raised [contain:layout_paint]",
        className,
      )}
    >
      {frame && (
        <iframe
          ref={liveStatus.ref as (element: HTMLIFrameElement | null) => void}
          src={frame.src}
          title={title}
          sandbox={SANDBOX}
          loading="lazy"
          tabIndex={-1}
          aria-hidden={frame.interactive ? undefined : true}
          referrerPolicy="no-referrer"
          allow={frame.interactive ? "fullscreen; autoplay; clipboard-write" : undefined}
          onLoad={liveStatus.handlers.onLoad}
          onError={liveStatus.handlers.onError}
          className={cn(
            "absolute border-0 bg-white transition-opacity duration-300 ease-out",
            scaled
              ? "top-0 left-0 origin-top-left pointer-events-none"
              : "inset-0 size-full",
            liveVisible ? "opacity-100" : "opacity-0",
          )}
          style={
            scaled
              ? {
                  width: frame.width ?? 1280,
                  height: frame.height ?? 800,
                  transform: `scale(${frame.scale})`,
                }
              : undefined
          }
        />
      )}

      {posterSrc && (
        <img
          ref={poster.ref as (element: HTMLImageElement | null) => void}
          src={posterSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={poster.handlers.onLoad}
          onError={poster.handlers.onError}
          className={cn(
            "pointer-events-none absolute inset-0 z-10 size-full object-cover transition-opacity duration-150 ease-out",
            layer === "poster" ? "opacity-100" : "opacity-0",
            posterClassName,
          )}
        />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ease-out",
          skeletonVisible && layer === "loading" ? "opacity-100" : "opacity-0",
        )}
      >
        <PreviewSkeleton />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 bg-raised text-muted transition-opacity duration-200 ease-out",
          layer === "empty" && !liveVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <ImageOff className="size-5" strokeWidth={1.5} />
        <span className="text-xs">{emptyLabel}</span>
      </div>
    </div>
  );
}
