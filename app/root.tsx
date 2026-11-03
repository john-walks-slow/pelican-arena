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
import { GateProvider } from "./components/gate-dialog";
import { toast, Toaster } from "./components/ui/toaster";
import { moderationCounts } from "./lib/moderation.server";
import { clearRouteCache } from "./lib/route-cache";
import { commitSession, getSession, getUser, type FlashToast } from "./lib/session.server";
import { useTrackNavigationHistory } from "./lib/navigation-history";
import { themeScript } from "./lib/theme";
import "./app.css";

type RouteMotion = "steady" | "forward" | "back" | "lateral-down" | "lateral-up";

function screenRank(key: string): { depth: number; slot: number } {
  if (key === "/") return { depth: 0, slot: 0 };
  if (key.startsWith("/leaderboard")) return { depth: 0, slot: 1 };
  if (key === "/prompts/new") return { depth: 0, slot: 2 };
  if (key.startsWith("/me")) return { depth: 0, slot: 3 };
  if (key.startsWith("/auth")) return { depth: 0, slot: 4 };
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
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const [user, session] = await Promise.all([getUser(request), getSession(request)]);
  const review = user?.role === "admin" ? await moderationCounts() : null;
  const flash = session.get("toast") ?? null;
  const headers = new Headers();
  if (flash) {
    session.unset("toast");
    headers.set("Set-Cookie", await commitSession(session));
  }
  return data(
    {
      toast: flash,
      review,
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

/** Marks the first paint as booting and records when it began. */
const bootScript = `document.documentElement.dataset.booting="true";document.documentElement.dataset.bootAt=performance.now()`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#f8f9fb" />
        <meta name="application-name" content="Pelican Arena" />
        <meta name="apple-mobile-web-app-title" content="Pelican" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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

function useRegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (import.meta.env.PROD || window.location.search.includes("pwa=1")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
}

export default function App({ loaderData }: Route.ComponentProps) {
  useTrackNavigationHistory();
  useRegisterServiceWorker();
  const location = useLocation();
  const screenKey = baseScreenKey(location.pathname);
  const prevScreenRef = useRef(screenKey);
  const [motion, setMotion] = useState<RouteMotion>("steady");

  if (prevScreenRef.current !== screenKey) {
    const direction = resolveMotion(prevScreenRef.current, screenKey);
    prevScreenRef.current = screenKey;
    setMotion(direction);
  }

  return (
    <GateProvider user={loaderData.user}>
      <FlashToasts flash={loaderData.toast} />
      <AppShell user={loaderData.user} reviewCount={loaderData.review?.total}>
        <div key={screenKey} data-motion={motion} className="route-stage">
          <Outlet />
        </div>
      </AppShell>
    </GateProvider>
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
