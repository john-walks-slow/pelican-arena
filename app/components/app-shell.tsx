import { LayoutGrid, LogOut, Menu, PenLine, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, Link, NavLink, useLocation } from "react-router";
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

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-1.5">
      <PelicanMark className="size-6 text-accent" />
      <span className="text-[15px] font-semibold tracking-tight">Pelican Arena</span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex h-8 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors ${
              isActive ? "bg-raised font-medium text-ink" : "text-muted hover:bg-raised hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`size-4 ${isActive ? "text-accent" : ""}`} strokeWidth={1.75} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Account({ user }: { user: ShellUser | null }) {
  const { pathname } = useLocation();
  if (!user) {
    return (
      <Button asChild variant="linuxdo" className="w-full justify-center gap-2">
        <a href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}>
          <LinuxDoIcon size={16} />
          <span>Linux DO 登录</span>
        </a>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-1">
      <Avatar template={user.avatarTemplate} username={user.username} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-tight">
          {user.name || user.username}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="truncate text-xs text-muted">@{user.username}</span>
          <span className="num text-[11px] text-muted">TL{user.trustLevel}</span>
        </div>
      </div>
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

export function AppShell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between px-3 py-5 lg:flex">
        <div className="space-y-5">
          <Brand />
          <NavItems />
        </div>
        <div>
          <Account user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-ground px-2 lg:hidden">
        <Brand />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="打开菜单"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-between bg-ground px-3 py-2 lg:hidden">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Brand />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭菜单"
                onClick={() => setMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <NavItems onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="border-t border-border py-3">
            <Account user={user} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-5 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
