import type { ComponentProps, MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import { canGoBackInApp } from "~/lib/navigation-history";

/**
 * Follows the in-app history when there is one, otherwise falls back to an
 * explicit target. Pages with an explicit `from` pass history={false}.
 */
type LinkProps = ComponentProps<typeof Link>;

export function BackLink({
  to,
  history = true,
  prefetch = "intent",
  onClick: onClickProp,
  ...rest
}: LinkProps & { history?: boolean }) {
  const navigate = useNavigate();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onClickProp?.(event);
    if (event.defaultPrevented || !history) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (canGoBackInApp()) {
      navigate(-1);
    } else {
      // Opening a detail in a new tab leaves no in-app entry to pop. Replace
      // the orphan entry so its fallback page does not point back at it.
      navigate(to, { replace: true });
    }
  }

  return <Link to={to} prefetch={prefetch} {...rest} onClick={onClick} />;
}
