import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { AppShell } from "./components/app-shell";
import { Button } from "./components/ui/button";
import { getUser } from "./lib/session.server";
import "./app.css";

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
  const user = await getUser(request);
  return {
    user: user && {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarTemplate: user.avatarTemplate,
      trustLevel: user.trustLevel,
      silenced: user.silenced,
      role: user.role,
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell user={loaderData.user}>
      <Outlet />
    </AppShell>
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
