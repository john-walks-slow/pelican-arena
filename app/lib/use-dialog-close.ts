import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/** Plays the dialog exit before navigating to the page behind it. */
export function useDialogClose(target: string) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(
      () => navigate(target, { replace: true, preventScrollReset: true }),
      reduced ? 0 : 160,
    );
  };

  return { open, close };
}
