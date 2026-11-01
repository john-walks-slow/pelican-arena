import { ArrowLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { Link } from "react-router";
import { BackLink } from "~/components/back-link";
import { cn } from "~/lib/utils";

export interface PageHeaderBack {
  to: string;
  label: string;
  history?: boolean;
  trail?: { to: string; label: string };
}

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  back?: PageHeaderBack;
  actions?: React.ReactNode;
  className?: string;
}

const COLLAPSED_DESKTOP = 52;
const COLLAPSED_MOBILE = 46;
const TITLE_COMPACT_SCALE = 16.5 / 28;
const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function clamp01(value: number) {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/**
 * Material-inspired collapsing sticky header.
 *
 * Uses negative sticky `top` (`shellTop - delta`) so the browser's native
 * compositor collapses the bar 1:1 with scroll without mutating layout height,
 * while child elements glide into the bottom compact rail via pure transforms.
 */
export function PageHeader({ title, subtitle, back, actions, className }: PageHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const backRowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = useState(false);

  useIsoLayoutEffect(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const titleEl = titleRef.current;
    if (!header || !inner || !titleEl) return;

    let delta = 0;
    let rafId = 0;
    let mounted = false;
    const desktopMql = window.matchMedia(DESKTOP_QUERY);
    const reducedMql = window.matchMedia(REDUCED_MOTION_QUERY);

    const applyScroll = () => {
      rafId = 0;
      // On fresh navigation / mount, guarantee uncollapsed state so the header
      // never flashes in sticky compact mode before scroll restoration completes.
      if (!mounted) {
        header.style.setProperty("--p", "0");
        header.dataset.compact = "false";
        return;
      }
      const y = Math.max(0, window.scrollY);
      if (reducedMql.matches) {
        const compact = delta > 4 ? y >= delta * 0.5 : y > 8;
        header.style.setProperty("--p", compact ? "1" : "0");
        header.dataset.compact = compact ? "true" : "false";
        return;
      }
      const p = delta > 4 ? clamp01(y / delta) : clamp01(y / 24);
      header.style.setProperty("--p", p.toFixed(4));
      header.dataset.compact = p > 0.65 ? "true" : "false";
    };

    const measure = () => {
      // Read natural un-transformed geometry by temporarily zeroing `--p`.
      const prevP = header.style.getPropertyValue("--p");
      header.style.setProperty("--p", "0");

      const isDesktop = desktopMql.matches;
      const collapsedH = isDesktop ? COLLAPSED_DESKTOP : COLLAPSED_MOBILE;
      const shellTop = isDesktop ? 0 : 48;

      const headerRect = header.getBoundingClientRect();
      const innerRect = inner.getBoundingClientRect();
      const H = headerRect.height;
      delta = Math.max(0, Math.round(H - collapsedH));

      const railCenterY = H - collapsedH / 2;

      const titleRect = titleEl.getBoundingClientRect();
      const titleTop = titleRect.top - headerRect.top;
      const titleLeft = titleRect.left - innerRect.left;
      const titleCenterY = titleTop + titleRect.height / 2;
      const isMulti = titleRect.height > 44;
      setMultiline((prev) => (prev === isMulti ? prev : isMulti));

      const hasBack = Boolean(back);
      const targetTitleX = hasBack ? 32 : 0;
      const titleDx = targetTitleX - titleLeft;
      const titleDy = railCenterY - titleCenterY;

      let backDy = 0;
      const backEl = backRowRef.current;
      if (backEl) {
        const backRect = backEl.getBoundingClientRect();
        const backCenterY = backRect.top - headerRect.top + backRect.height / 2;
        backDy = railCenterY - backCenterY;
      }

      let actionsDx = 0;
      let actionsDy = 0;
      let actionsScale = 1;
      let compactRightReserve = 0;
      const actionsEl = actionsRef.current;
      if (actionsEl) {
        const actRect = actionsEl.getBoundingClientRect();
        const actRight = actRect.right - innerRect.left;
        const actCenterY = actRect.top - headerRect.top + actRect.height / 2;
        actionsDx = innerRect.width - actRight;
        actionsDy = railCenterY - actCenterY;

        const maxActionsWidth = innerRect.width - targetTitleX - 96;
        if (actRect.width > maxActionsWidth && actRect.width > 0) {
          actionsScale = Math.max(0.84, Math.min(1, maxActionsWidth / actRect.width));
        }
        compactRightReserve = Math.ceil(actRect.width * actionsScale) + 16;
      }

      // Compute how much of the scaled single-line title overflows into actions.
      const scaledTitleEnd = targetTitleX + titleRect.width * TITLE_COMPACT_SCALE;
      const maxTitleEnd = Math.max(targetTitleX + 64, innerRect.width - compactRightReserve);
      const overflowPx = Math.max(0, scaledTitleEnd - maxTitleEnd);
      const unscaledClipRight = overflowPx > 0 ? overflowPx / TITLE_COMPACT_SCALE : 0;

      header.style.setProperty("--shell-top", `${shellTop}px`);
      header.style.setProperty("--collapsed-h", `${collapsedH}px`);
      header.style.setProperty("--delta", `${delta}px`);
      header.style.setProperty("--title-dx", `${titleDx.toFixed(1)}px`);
      header.style.setProperty("--title-dy", `${titleDy.toFixed(1)}px`);
      header.style.setProperty("--title-scale", TITLE_COMPACT_SCALE.toFixed(4));
      header.style.setProperty("--title-clip-r", `${unscaledClipRight.toFixed(1)}px`);
      header.style.setProperty("--back-dy", `${backDy.toFixed(1)}px`);
      header.style.setProperty("--actions-dx", `${actionsDx.toFixed(1)}px`);
      header.style.setProperty("--actions-dy", `${actionsDy.toFixed(1)}px`);
      header.style.setProperty("--actions-scale", actionsScale.toFixed(4));
      header.style.setProperty("--compact-pl", `${targetTitleX}px`);
      header.style.setProperty("--compact-pr", `${compactRightReserve}px`);

      if (prevP) header.style.setProperty("--p", prevP);
      applyScroll();
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(applyScroll);
    };

    measure();
    header.style.setProperty("--p", "0");
    header.dataset.compact = "false";

    const rafMount = window.requestAnimationFrame(() => {
      mounted = true;
      if (window.scrollY > 0) {
        applyScroll();
      }
    });

    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    if (actionsRef.current) ro.observe(actionsRef.current);

    window.addEventListener("scroll", onScroll, { passive: true });
    desktopMql.addEventListener("change", measure);
    reducedMql.addEventListener("change", applyScroll);

    return () => {
      window.cancelAnimationFrame(rafMount);
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      desktopMql.removeEventListener("change", measure);
      reducedMql.removeEventListener("change", applyScroll);
    };
  }, [back?.to, back?.label, back?.trail?.to, title, Boolean(actions)]);

  return (
    <ViewTransition
      name="page-header-rail"
      share="page-rail"
      enter="page-rail-in"
      exit="page-rail-out"
      default="none"
    >
      <header
        ref={headerRef}
        data-compact="false"
        data-multiline={multiline ? "true" : "false"}
        className={cn("page-header sticky z-20 -mt-6 lg:-mt-8", className)}
      >
        {/* Full-bleed tonal glass surface spanning the main column */}
        <div aria-hidden="true" className="page-header-backdrop pointer-events-none" />

        <div ref={innerRef} className="relative z-10 pt-6 pb-3 lg:pt-8 lg:pb-3.5">
          {back && (
            <div
              ref={backRowRef}
              className="page-header-back mb-2 flex items-center gap-2 text-xs text-muted"
            >
              <BackLink
                to={back.to}
                history={back.history ?? true}
                aria-label={`返回${back.label}`}
                className="page-header-back-btn group inline-flex items-center gap-1 rounded-control text-muted transition-colors hover:text-ink"
              >
                <span className="page-header-back-icon inline-flex size-7 -ml-1.5 items-center justify-center rounded-control transition-colors group-hover:bg-active/70">
                  <ArrowLeft className="size-3.5 shrink-0" strokeWidth={1.85} />
                </span>
                <span className="page-header-back-label truncate">{back.label}</span>
              </BackLink>
              {back.trail && (
                <span className="page-header-back-trail flex min-w-0 items-center gap-2">
                  <span>·</span>
                  <Link to={back.trail.to} className="truncate hover:text-ink">
                    {back.trail.label}
                  </Link>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
            <div className="min-w-0 flex-1 basis-60">
              <h1
                ref={titleRef}
                className="page-header-title w-fit max-w-full text-title font-bold tracking-tight text-ink"
              >
                {title}
              </h1>
              {subtitle && (
                <div className="page-header-subtitle mt-1.5 text-sm text-muted">{subtitle}</div>
              )}
            </div>

            {actions && (
              <div
                ref={actionsRef}
                className="page-header-actions flex shrink-0 flex-wrap items-center justify-end gap-1.5"
              >
                {actions}
              </div>
            )}
          </div>

          {/* Relay compact title used only when expanded h1 wraps across multiple lines */}
          {multiline && (
            <div
              aria-hidden="true"
              className="page-header-compact-relay pointer-events-none absolute inset-x-0 bottom-0 flex items-center"
            >
              <span className="truncate text-[16.5px] font-bold tracking-tight text-ink">
                {title}
              </span>
            </div>
          )}
        </div>
      </header>
    </ViewTransition>
  );
}
