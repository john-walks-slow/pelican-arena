export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "pelican-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const THEME_COLOR: Record<"light" | "dark", string> = {
  light: "#f8f9fb",
  dark: "#0f1114",
};

const listeners = new Set<() => void>();
let preference: ThemePreference | null = null;
let listening = false;

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(next: ThemePreference): "light" | "dark" {
  if (next !== "system") return next;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function paint() {
  const theme = resolveTheme(getThemePreference());
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

function emit() {
  for (const listener of listeners) listener();
}

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  preference ??= readStoredPreference();
  return preference;
}

/** The palette currently on screen, after resolving `system`. */
export function getResolvedTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode or a blocked storage partition: the choice lasts this visit.
  }
  paint();
  emit();
}

function startListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;

  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (getThemePreference() !== "system") return;
    paint();
    emit();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    preference = null;
    paint();
    emit();
  });
}

export function subscribeTheme(listener: () => void) {
  startListening();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Runs before the first paint: resolves the stored preference (or the system
 * one) into `data-theme` so the page never flashes the wrong palette.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}")}catch(e){}})()`;
