import { Form, redirect } from "react-router";
import type { Route } from "./+types/auth.login";
import { authorizeUrl, isOAuthConfigured } from "~/lib/linuxdo.server";
import { commitSession, getSession } from "~/lib/session.server";
import { upsertUser } from "~/lib/users.server";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const devLoginEnabled = () => import.meta.env.DEV && !isOAuthConfigured();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (devLoginEnabled()) return { returnTo };
  if (!isOAuthConfigured()) {
    throw new Response("未配置 Linux DO Connect 凭据", { status: 500 });
  }

  const session = await getSession(request);
  const state = crypto.randomUUID();
  session.set("oauthState", state);
  session.set("returnTo", returnTo);
  return redirect(authorizeUrl(state), {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

/** Local development without OAuth credentials: sign in as any forum user. */
export async function action({ request }: Route.ActionArgs) {
  if (!devLoginEnabled()) throw new Response("Not Found", { status: 404 });
  const form = await request.formData();
  const username = String(form.get("username") || "dev").trim();
  const trustLevel = Number(form.get("trustLevel") ?? 2);
  const user = await upsertUser({
    id: 1_000_000 + [...username].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1_000_000, 7),
    username,
    name: username,
    avatar_template: null,
    active: true,
    trust_level: trustLevel,
    silenced: false,
  });
  const session = await getSession(request);
  session.set("userId", user.id);
  return redirect(safeReturnTo(String(form.get("returnTo"))), {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function DevLogin({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-title font-bold">开发登录</h1>
      <p className="mt-1 text-muted">
        本地未配置 Linux DO Connect，可直接以任意用户名登录。
      </p>
      <Form method="post" className="panel mt-6 space-y-4 p-5">
        <input type="hidden" name="returnTo" value={loaderData.returnTo} />
        <div>
          <label className="label" htmlFor="username">用户名</label>
          <input id="username" name="username" defaultValue="pelican" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="trustLevel">信任等级</label>
          <select id="trustLevel" name="trustLevel" defaultValue="2" className="field">
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>TL{n}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary w-full">登录</button>
      </Form>
    </div>
  );
}
