import { LayoutGrid, LogOut, PenLine, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link, NavLink, useLocation, useNavigation } from "react-router";
import { Avatar } from "./avatar";
import { PelicanMark } from "./pelican-mark";
import { Button } from "./ui/button";
import { LinuxDoIcon } from "./ui/linuxdo-icon";

export interface ShellUser {
  id: number;
  username: string;
  name: string | null;
  avatarTemplate: string | null;
  trustLevel: number;
  role: "user" | "admin";
}

const NAV = [
  { to: "/", label: "题目", icon: LayoutGrid, end: true },
  { to: "/prompts/new", label: "出题", icon: PenLine, end: false },
];

export function baseScreenKey(pathname: string) {
  return (
    pathname
      .replace(/^(\/p\/[^/]+)\/submit$/, "$1")
      .replace(/^(\/s\/[^/]+)\/edit$/, "$1") || "/"
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-1.5">
      <PelicanMark className="size-6 text-accent" />
      <span className="text-[15px] font-semibold tracking-tight">Pelican Arena</span>
    </Link>
  );
}

function NavItems({
  onNavigate,
  user,
  morphPill = false,
}: {
  onNavigate?: () => void;
  user: ShellUser | null;
  morphPill?: boolean;
}) {
  const items = user
    ? [...NAV, { to: "/me", label: "我的", icon: UserRound, end: false }]
    : NAV;
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors duration-150 ${
              isActive ? "font-medium text-ink" : "text-muted hover:bg-raised/70 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden="true"
                  style={morphPill ? { viewTransitionName: "nav-active-pill" } : undefined}
                  className="pointer-events-none absolute inset-0 rounded-control bg-raised"
                />
              )}
              <Icon
                className={`relative z-10 size-4 transition-colors duration-150 ${isActive ? "text-accent" : ""}`}
                strokeWidth={1.75}
              />
              <span className="relative z-10">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Three lines morph into an X; the button stays exactly where it was. */
function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const line =
    "absolute left-1/2 h-px w-[17px] -translate-x-1/2 rounded-full bg-ink transition-all duration-200 ease-out motion-reduce:transition-none";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "关闭菜单" : "打开菜单"}
      aria-expanded={open}
      aria-controls="mobile-menu"
      className="relative flex size-10 items-center justify-center rounded-control transition-colors hover:bg-raised active:scale-95 motion-reduce:transition-none"
    >
      <span className={`${line} ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[15px]"}`} />
      <span
        className={`${line} top-1/2 -translate-y-1/2 ${open ? "scale-x-0 opacity-0" : "opacity-100"}`}
      />
      <span className={`${line} ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-[24px]"}`} />
    </button>
  );
}

function Account({ user }: { user: ShellUser | null }) {
  const { pathname } = useLocation();
  if (!user) {
    return (
      <Button asChild variant="linuxdo" className="w-full justify-center gap-2">
        <a href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
          <LinuxDoIcon size={16} />
          Linux DO 登录
        </a>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-1">
      <Link
        to="/me"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control transition-opacity hover:opacity-80"
      >
        <Avatar template={user.avatarTemplate} username={user.username} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">
            {user.name || user.username}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-xs text-muted">@{user.username}</span>
            <span className="num text-[11px] text-muted">TL{user.trustLevel}</span>
          </div>
        </div>
      </Link>
      <Form method="post" action="/auth/logout">
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          className="text-muted hover:text-negative"
          title="退出登录"
          aria-label="退出登录"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
        </Button>
      </Form>
    </div>
  );
}

/** Keeps the panel mounted long enough to play its exit. */
function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return mounted;
}

function NavigationProgress() {
  const navigation = useNavigation();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const isScreenLoad =
    navigation.state === "loading" &&
    navigation.location != null &&
    baseScreenKey(navigation.location.pathname) !== baseScreenKey(location.pathname);

  useEffect(() => {
    if (!isScreenLoad) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, [isScreenLoad]);

  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[1.5px] overflow-hidden"
    >
      <div className="nav-progress-bar h-full w-full origin-left bg-accent/80" />
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const menuMounted = usePresence(menuOpen, 150);
  const isBareScreen = pathname.startsWith("/auth/");

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 6);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [pathname]);

  // Freeze the page behind the panel without a scrollbar-driven shift.
  useEffect(() => {
    const body = document.body;
    if (!menuOpen) return;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
      <NavigationProgress />

      <aside className="sticky top-0 hidden h-dvh flex-col justify-between px-3 py-5 lg:flex">
        <div className="space-y-5">
          <Brand />
          <NavItems user={user} morphPill />
        </div>
        <Account user={user} />
      </aside>

      <header
        className={`sticky top-0 z-40 flex h-12 items-center justify-between px-2 transition-[background-color,border-color] duration-150 lg:hidden ${
          menuOpen
            ? "border-b border-border bg-ground"
            : scrolled
              ? `${isBareScreen ? "border-b border-border" : "border-b border-transparent"} bg-[color-mix(in_srgb,var(--color-surface)_84%,var(--color-raised))] backdrop-blur-md`
              : "border-b border-transparent bg-ground"
        }`}
      >
        <Brand />
        <MenuButton open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
      </header>

      {menuMounted && (
        <div
          id="mobile-menu"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`fixed inset-x-0 top-12 bottom-0 z-30 flex flex-col justify-between bg-ground px-3 py-4 transition-opacity duration-150 ease-out motion-reduce:transition-none lg:hidden ${
            menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          <NavItems user={user} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-border pt-3">
            <Account user={user} />
          </div>
        </div>
      )}

      <main className="@container/main min-w-0 px-5 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
