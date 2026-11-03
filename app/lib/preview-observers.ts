/**
 * Gallery previews need two passive measurements: whether a card is near the
 * viewport, and how wide it is. Creating an observer per card costs tens of
 * observers on a full page, so both are shared process-wide.
 */

type VisibilityListener = (visible: boolean) => void;
type WidthListener = (width: number) => void;

const PRELOAD_MARGIN = 480;

const visibilityListeners = new Map<Element, VisibilityListener>();
const widthListeners = new Map<Element, WidthListener>();

let visibilityObserver: IntersectionObserver | null = null;
let widthObserver: ResizeObserver | null = null;

export function observeVisibility(element: Element, listener: VisibilityListener) {
  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibilityListeners.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { rootMargin: `${PRELOAD_MARGIN}px` },
    );
  }
  visibilityListeners.set(element, listener);
  visibilityObserver.observe(element);

  return () => {
    visibilityListeners.delete(element);
    visibilityObserver?.unobserve(element);
  };
}

export function observeWidth(element: Element, listener: WidthListener) {
  if (!widthObserver) {
    widthObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        widthListeners.get(entry.target)?.(entry.contentRect.width);
      }
    });
  }
  widthListeners.set(element, listener);
  widthObserver.observe(element);

  return () => {
    widthListeners.delete(element);
    widthObserver?.unobserve(element);
  };
}
