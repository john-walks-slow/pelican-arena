import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PreviewSkeleton } from "~/components/preview-skeleton";
import { SANDBOX } from "~/lib/sandbox";
import { cn } from "~/lib/utils";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const PRELOAD_MARGIN = 480;
const SKELETON_DELAY = 120;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Remembers last measured scale per preview URL so returning to a cached tab renders frame 1 without a blank box flash. */
const knownScales = new Map<string, number>();

/**
 * A submitted page preview that displays a static thumbnail by default and
 * mounts the live interactive iframe only when hovered.
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
  const cachedScale = knownScales.get(src) ?? 0;
  const [scale, setScale] = useState(cachedScale);
  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Thumbnail states
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  // Live iframe states
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const shouldMountIframe = visible && (isHovered || thumbError || !thumbnailSrc);

  useEffect(() => {
    setThumbLoaded(false);
    setThumbError(false);
  }, [thumbnailSrc]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [src, isHovered]);

  // Skeleton indicator timer
  useEffect(() => {
    if (thumbLoaded || iframeLoaded) {
      setShowSkeleton(false);
      return;
    }
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY);
    return () => clearTimeout(timer);
  }, [thumbLoaded, iframeLoaded]);

  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (rect.bottom > -PRELOAD_MARGIN && rect.top < window.innerHeight + PRELOAD_MARGIN) {
      setVisible(true);
    }
  }, [src]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const initialWidth = box.clientWidth;
    if (initialWidth > 0) {
      const nextScale = initialWidth / VIEWPORT_WIDTH;
      knownScales.set(src, nextScale);
      setScale(nextScale);
    }
    const resize = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) {
        const nextScale = w / VIEWPORT_WIDTH;
        knownScales.set(src, nextScale);
        setScale(nextScale);
      }
    });
    const intersect = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: `${PRELOAD_MARGIN}px`,
    });
    resize.observe(box);
    intersect.observe(box);
    return () => {
      resize.disconnect();
      intersect.disconnect();
    };
  }, [src]);

  return (
    <div
      ref={boxRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative aspect-[16/10] w-full overflow-hidden bg-raised [contain:layout_paint]",
        className,
      )}
    >
      {/* Loading Skeleton */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out",
          showSkeleton && !thumbLoaded && !iframeLoaded ? "opacity-100" : "opacity-0",
        )}
      >
        <PreviewSkeleton />
      </div>

      {/* Static Thumbnail (Default state) */}
      {thumbnailSrc && !thumbError && (
        <img
          src={thumbnailSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={() => setThumbLoaded(true)}
          onError={() => setThumbError(true)}
          className={cn(
            "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out",
            thumbLoaded && (!isHovered || !iframeLoaded) ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* Live Iframe (Mounted only on hover or when thumbnail is unavailable) */}
      {shouldMountIframe && scale > 0 && (
        <iframe
          src={src}
          title={title}
          sandbox={SANDBOX}
          loading="lazy"
          tabIndex={-1}
          referrerPolicy="no-referrer"
          onLoad={() => setIframeLoaded(true)}
          className={cn(
            "pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white transition-opacity duration-300 ease-out",
            iframeLoaded ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      )}
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const timer = setTimeout(() => setLoaded(true), 8000);
    return () => clearTimeout(timer);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-raised", className)}>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-out",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <PreviewSkeleton />
      </div>
      <iframe
        src={src}
        title={title}
        sandbox={SANDBOX}
        referrerPolicy="no-referrer"
        allow="fullscreen; autoplay; clipboard-write"
        onLoad={() => setLoaded(true)}
        className={cn(
          "block size-full border-0 bg-white transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
