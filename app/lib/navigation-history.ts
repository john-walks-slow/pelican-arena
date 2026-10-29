import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

// Browser history entries created by client-side navigation in this tab.
// `history.state.idx` is not reliable in every React Router transition, so the
// stack is tracked here and used only as a "can go back" signal.
let keys: string[] = [];

export function canGoBackInApp() {
  return keys.length > 1;
}

export function useTrackNavigationHistory() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const key = location.key;

    if (keys.length === 0) {
      keys = [key];
      return;
    }

    if (navigationType === "POP") {
      const index = keys.lastIndexOf(key);
      if (index >= 0) {
        keys = keys.slice(0, index + 1);
      } else {
        keys = [key];
      }
      return;
    }

    if (navigationType === "REPLACE") {
      keys[keys.length - 1] = key;
      return;
    }

    if (keys[keys.length - 1] !== key) {
      keys.push(key);
    }
  }, [location.key, navigationType]);
}
