import type { ComponentProps, MouseEvent } from "react";
import { Link, useNavigate } from "react-router";

/**
 * Follows the in-app history when there is one, otherwise falls back to an
 * explicit target. Pages with an explicit `from` pass history={false}.
 */
type LinkProps = ComponentProps<typeof Link>;

export function BackLink({
  to,
  history = true,
  onClick: onClickProp,
  ...rest
}: LinkProps & { history?: boolean }) {
  const navigate = useNavigate();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onClickProp?.(event);
    if (event.defaultPrevented || !history) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const idx = Number(
      (window.history.state as { idx?: number } | null)?.idx ?? 0,
    );
    if (idx > 0) {
      event.preventDefault();
      navigate(-1);
    }
  }

  return <Link to={to} {...rest} onClick={onClick} />;
}
