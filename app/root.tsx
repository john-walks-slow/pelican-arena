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

import { useEffect, useLayoutEffect, useRef, ViewTransition } from "react";
import { useLocation, useNavigation, useNavigationType } from "react-router";
import type { Route } from "./+types/root";
import { AppShell } from "./components/app-shell";
import { BootScreen } from "./components/boot-screen";
import { Button } from "./components/ui/button";
import { toast, Toaster } from "./components/ui/toaster";
import { moderationCounts } from "./lib/moderation.server";
import { clearRouteCache } from "./lib/route-cache";
import { commitSession, getSession, getUser, type FlashToast } from "./lib/session.server";
import { screenKey } from "./lib/navigation";
import { setMorphEnabled } from "./lib/morph";
import { recallScroll, rememberScroll } from "./lib/scroll-memory";
import { useTrackNavigationHistory } from "./lib/navigation-history";
import { themeScript } from "./lib/theme";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
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
  const navigation = useNavigation();
  const navigationType = useNavigationType();
  const key = screenKey(location.pathname);
  const ready = navigation.state === "idle";
  const restoring = navigationType === "POP";
  // The router commits several times per navigation (pending, data, Suspense
  // reveals). Only the commit that actually changes the screen may animate;
  // otherwise each intermediate commit replays the page cross-fade.
  const lastScreen = useRef(key);
  const screenChanged = lastScreen.current !== key;
  // Remember where the outgoing screen was scrolled before the router resets
  // it. Reading window.scrollY at render time is already too late.
  useEffect(() => {
    const onNavigateIntent = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target || anchor.hasAttribute("download")) return;
      if (anchor.origin !== window.location.origin) return;

    };
    const onPopState = () => {
      setMorphEnabled(false);
    };
    document.addEventListener("click", onNavigateIntent, true);
    window.addEventListener("popstate", onPopState, true);
    return () => {
      document.removeEventListener("click", onNavigateIntent, true);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (ready) lastScreen.current = key;
  }, [key, ready]);

  // Scroll offsets live per history entry. Recording them here lets the header
  // restore before its first measure, instead of after the browser paints the
  // new page at the old offset.
  useEffect(() => {
    const remember = () => rememberScroll(location.key, window.scrollY);
    remember();
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [location.key]);

  const restoreY = restoring ? recallScroll(location.key) : null;

  // React captures the incoming screen after layout effects, so the viewport
  // has to be back at the top before that snapshot is measured. A history
  // entry keeps its own scroll position.
  useLayoutEffect(() => {
    if (!ready) return;
    if (restoring) {
      if (restoreY != null) window.scrollTo(0, restoreY);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [key, ready, restoring, restoreY]);

  return (
    <>
      <FlashToasts flash={loaderData.toast} />
      <AppShell user={loaderData.user} reviewCount={loaderData.review?.total}>
        <ViewTransition update={screenChanged && ready ? "page" : "none"} default="none">
          <div className="route-stage">
            <Outlet />
          </div>
        </ViewTransition>
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
