import { LayoutGrid, LogIn, LogOut, Menu, PenLine, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";
import { Avatar } from "./avatar";
import { PelicanMark } from "./pelican-mark";

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
  { to: "/leaderboard", label: "榜单", icon: Trophy, end: false },
  { to: "/prompts/new", label: "出题", icon: PenLine, end: false },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-2 font-semibold text-ink">
      <PelicanMark className="size-6 text-accent" />
      <span className="text-[15px] tracking-tight">Pelican Arena</span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex h-8 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors ${
              isActive
                ? "bg-accent-soft font-medium text-accent-ink"
                : "text-muted hover:bg-raised hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`size-4 ${isActive ? "text-accent" : ""}`} strokeWidth={1.75} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Account({ user }: { user: ShellUser | null }) {
  const location = useLocation();
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return (
      <a href={`/auth/login?returnTo=${returnTo}`} className="btn-outline w-full">
        <LogIn className="size-4" strokeWidth={1.75} />
        使用 Linux DO 登录
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-2">
      <Avatar template={user.avatarTemplate} username={user.username} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.name || user.username}</div>
        <div className="text-xs text-muted">
          @{user.username} · TL{user.trustLevel}
        </div>
      </div>
      <Form method="post" action="/auth/logout">
        <button type="submit" className="btn-ghost size-8 px-0" aria-label="退出登录" title="退出登录">
          <LogOut className="size-4" strokeWidth={1.75} />
        </button>
      </Form>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 self-start px-3 py-5 lg:flex">
        <Brand />
        <NavItems />
        <div className="mt-auto">
          <Account user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-ground px-2 lg:hidden">
        <Brand />
        <button
          type="button"
          className="btn-ghost size-10 px-0"
          aria-label="打开菜单"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col gap-6 bg-ground px-3 py-2 lg:hidden">
          <div className="flex h-10 items-center justify-between">
            <Brand />
            <button
              type="button"
              className="btn-ghost size-10 px-0"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          <NavItems onNavigate={() => setMenuOpen(false)} />
          <div className="mt-auto pb-4">
            <Account user={user} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-5 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
