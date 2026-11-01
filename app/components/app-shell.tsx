import { LayoutGrid, LogOut, PenLine, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link, NavLink, useLocation, useNavigation } from "react-router";
import { Avatar } from "./avatar";
import { PelicanRide } from "./pelican-ride";
import { ThemeMenu } from "./theme-menu";
import { Button } from "./ui/button";
import { LinuxDoIcon } from "./ui/linuxdo-icon";
import { screenKey } from "~/lib/navigation";

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
  { to: "/leaderboard", label: "排名", icon: Trophy, end: false },
  { to: "/prompts/new", label: "出题", icon: PenLine, end: false },
];

const ADMIN_NAV = { to: "/admin", label: "审核", icon: ShieldCheck, end: false };

function Brand() {
  return (
    <Link to="/" prefetch="intent" className="flex items-center gap-2 px-1.5">
      <PelicanRide className="brand-mark size-6 text-accent" />
      <span className="text-[15px] font-semibold tracking-tight">Pelican Arena</span>
    </Link>
  );
}

function NavItems({
  onNavigate,
  user,
  reviewCount,
  slidingPill = true,
}: {
  onNavigate?: () => void;
  user: ShellUser | null;
  reviewCount?: number;
  slidingPill?: boolean;
}) {
  const { pathname } = useLocation();
  const items = [
    ...NAV,
    ...(user ? [{ to: "/me", label: "我的", icon: UserRound, end: false }] : []),
    ...(reviewCount == null ? [] : [ADMIN_NAV]),
  ];
  const activeIndex = items.findIndex(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
  );

  return (
    <nav className="relative flex flex-col gap-0.5">
      {slidingPill && activeIndex >= 0 && (
        <span
          aria-hidden="true"
          style={{
            transform: `translate3d(0, ${activeIndex * 38}px, 0)`,
            viewTransitionName: "nav-active-pill",
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-control bg-raised transition-transform duration-200 ease-[var(--ease-spatial)] motion-reduce:transition-none"
        />
      )}
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          prefetch="intent"
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative z-10 flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors duration-150 ${
              isActive
                ? `${slidingPill ? "" : "bg-raised "}font-medium text-ink`
                : "text-muted hover:bg-raised/65 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={`size-4 transition-colors duration-150 ${isActive ? "text-accent" : ""}`}
                strokeWidth={1.75}
              />
              <span>{label}</span>
              {to === ADMIN_NAV.to && reviewCount ? (
                <span className="num ml-auto text-[11px] text-muted">{reviewCount}</span>
              ) : null}
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
        prefetch="intent"
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
  const [phase, setPhase] = useState<"idle" | "running" | "completing">("idle");

  const isScreenLoad =
    navigation.state === "loading" &&
    navigation.location != null &&
    screenKey(navigation.location.pathname) !== screenKey(location.pathname);

  useEffect(() => {
    if (isScreenLoad) {
      const timer = setTimeout(() => setPhase("running"), 220);
      return () => clearTimeout(timer);
    }
    setPhase((prev) => (prev === "running" ? "completing" : prev));
  }, [isScreenLoad]);

  useEffect(() => {
    if (phase !== "completing") return;
    const timer = setTimeout(() => setPhase("idle"), 220);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] overflow-hidden transition-opacity duration-200 ${
        phase === "completing" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`h-full w-full origin-left bg-accent shadow-[0_0_8px_var(--color-accent)] ${
          phase === "completing"
            ? "scale-x-100 transition-transform duration-150 ease-out"
            : "nav-progress-bar"
        }`}
      />
    </div>
  );
}

export function AppShell({
  user,
  reviewCount,
  children,
}: {
  user: ShellUser | null;
  reviewCount?: number;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const navigating = useNavigation().state !== "idle";
  const menuMounted = usePresence(menuOpen, 150);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 6);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [pathname]);

  // Lock the viewport, not <body>: with `html` clipping horizontally, a
  // `body { overflow: hidden }` lock turns body into a scroll container and
  // the sticky bars drop off-screen. Locking the document keeps them in place.
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    root.dataset.menuOpen = "true";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.menuOpen;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div
      className="shell min-h-dvh lg:grid lg:grid-cols-[228px_minmax(0,1fr)]"
      data-navigating={navigating ? "true" : "false"}
    >
      <NavigationProgress />

      <aside className="sticky top-0 hidden h-dvh flex-col justify-between px-3 py-5 lg:flex">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Brand />
            <ThemeMenu />
          </div>
          <NavItems user={user} reviewCount={reviewCount} />
        </div>
        <Account user={user} />
      </aside>

      <header
        data-scrolled={scrolled}
        className="shell-bar fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between px-2 transition-[background-color,border-color] duration-150 lg:hidden"
      >
        <Brand />
        <div className="flex items-center">
          <ThemeMenu className="size-10" />
          <MenuButton open={menuOpen} onToggle={() => setMenuOpen((v) => !v)} />
        </div>
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
          <NavItems user={user} reviewCount={reviewCount} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-border pt-3">
            <Account user={user} />
          </div>
        </div>
      )}

      <main className="main-column @container/main min-w-0 px-5 pt-[72px] pb-16 sm:px-6 lg:px-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
