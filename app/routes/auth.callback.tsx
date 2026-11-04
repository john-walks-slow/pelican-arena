import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { exchangeCode } from "~/lib/linuxdo.server";
import { safeFrom } from "~/lib/navigation";
import { commitSession, getSession } from "~/lib/session.server";
import { upsertUser } from "~/lib/users.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession(request);

  if (!code || !state || state !== session.get("oauthState")) {
    throw new Response("登录已过期，请重新登录", { status: 400 });
  }

  const profile = await exchangeCode(code);
  const user = await upsertUser(profile);
  const returnTo = safeFrom(session.get("returnTo")) ?? "/";
  session.unset("oauthState");
  session.unset("returnTo");
  session.set("userId", user.id);
  return redirect(returnTo, { headers: { "Set-Cookie": await commitSession(session) } });
}
