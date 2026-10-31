import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import type { Route } from "./+types/root";
import { AppShell, baseScreenKey } from "./components/app-shell";
import { BootScreen } from "./components/boot-screen";
import { Button } from "./components/ui/button";
import { toast, Toaster } from "./components/ui/toaster";
import { clearRouteCache } from "./lib/route-cache";
import { commitSession, getSession, getUser, type FlashToast } from "./lib/session.server";
import { useTrackNavigationHistory } from "./lib/navigation-history";
import { themeScript } from "./lib/theme";
import "./app.css";

type RouteMotion = "steady" | "forward" | "back" | "lateral-down" | "lateral-up";

function screenRank(key: string): { depth: number; slot: number } {
  if (key === "/") return { depth: 0, slot: 0 };
  if (key === "/prompts/new") return { depth: 0, slot: 1 };
  if (key.startsWith("/me")) return { depth: 0, slot: 2 };
  if (key.startsWith("/auth")) return { depth: 0, slot: 3 };
  if (/^\/p\/[^/]+\/edit$/.test(key)) return { depth: 2, slot: 0 };
  if (key.startsWith("/p/")) return { depth: 1, slot: 0 };
  if (key.startsWith("/s/") || key.startsWith("/compare")) return { depth: 2, slot: 0 };
  return { depth: 1, slot: 0 };
}

function resolveMotion(prevKey: string, nextKey: string): RouteMotion {
  if (prevKey === nextKey) return "steady";
  const prev = screenRank(prevKey);
  const next = screenRank(nextKey);
  if (next.depth > prev.depth) return "forward";
  if (next.depth < prev.depth) return "back";
  if (next.depth === 0 && prev.depth === 0) {
    return next.slot >= prev.slot ? "lateral-down" : "lateral-up";
  }
  return "forward";
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const [user, session] = await Promise.all([getUser(request), getSession(request)]);
  const flash = session.get("toast") ?? null;
  const headers = new Headers();
  if (flash) {
    session.unset("toast");
    headers.set("Set-Cookie", await commitSession(session));
  }
  return data(
    {
      toast: flash,
      user: user && {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarTemplate: user.avatarTemplate,
        trustLevel: user.trustLevel,
        silenced: user.silenced,
        role: user.role,
      },
    },
    { headers },
  );
}

export function shouldRevalidate({
  formMethod,
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod !== "GET") {
    clearRouteCache();
    return defaultShouldRevalidate;
  }
  if (actionResult !== undefined) {
    clearRouteCache();
    return defaultShouldRevalidate;
  }
  return false;
}

/** Flags the first paint as booting; `BootScreen` lifts it once hydration is done. */
const bootScript = `document.documentElement.dataset.booting="true"`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#f8f9fb" />
        <Meta />
        <Links />
        {/* Resolve the appearance before the browser paints the first frame. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <BootScreen />
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function FlashToasts({ flash }: { flash: FlashToast | null }) {
  useEffect(() => {
    if (!flash) return;
    toast[flash.kind](flash.message);
  }, [flash]);
  return null;
}

export default function App({ loaderData }: Route.ComponentProps) {
  useTrackNavigationHistory();
  const location = useLocation();
  const screenKey = baseScreenKey(location.pathname);
  const prevScreenRef = useRef(screenKey);
  const [motion, setMotion] = useState<RouteMotion>("steady");

  if (prevScreenRef.current !== screenKey) {
    const nextMotion = resolveMotion(prevScreenRef.current, screenKey);
    prevScreenRef.current = screenKey;
    setMotion(nextMotion);
  }

  return (
    <>
      <FlashToasts flash={loaderData.toast} />
      <AppShell user={loaderData.user}>
        <div key={screenKey} data-motion={motion} className="route-stage">
          <Outlet />
        </div>
      </AppShell>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "出错了";
  let details = "页面加载失败，请稍后再试。";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "找不到页面";
      details = "链接可能已失效，或内容已被隐藏。";
    } else if (error.status === 403) {
      title = "没有权限";
      details = typeof error.data === "string" ? error.data : details;
    } else {
      details = typeof error.data === "string" ? error.data : error.statusText || details;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{details}</p>
      <Button asChild variant="outline" className="mt-6">
        <a href="/">返回题目列表</a>
      </Button>
      {stack && (
        <pre className="mt-8 overflow-x-auto rounded-card bg-raised p-4 text-left font-mono text-xs">
          {stack}
        </pre>
      )}
    </main>
  );
}
