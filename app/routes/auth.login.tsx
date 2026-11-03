import { ShieldCheck } from "lucide-react";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/auth.login";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { LinuxDoIcon } from "~/components/ui/linuxdo-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { authorizeUrl, isOAuthConfigured } from "~/lib/linuxdo.server";
import { safeFrom } from "~/lib/navigation";
import { commitSession, getSession } from "~/lib/session.server";
import { upsertUser } from "~/lib/users.server";

function safeReturnTo(value: string | null) {
  return safeFrom(value) ?? "/";
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
    <div className="mx-auto flex min-h-[65vh] max-w-sm flex-col justify-center px-4">
      <Card>
        <CardHeader className="items-center text-center">
          <LinuxDoIcon size={40} />
          <CardTitle className="pt-1 text-base">Linux DO 登录</CardTitle>
          <CardDescription className="text-xs">
            本地未配置 OAuth，可以任意身份登录。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" action="/auth/login" className="space-y-4">
            <input type="hidden" name="returnTo" value={loaderData.returnTo} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" htmlFor="username">
                用户名
              </label>
              <Input
                id="username"
                name="username"
                defaultValue="pelican"
                placeholder="例如: neo, 666"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" htmlFor="trustLevel">
                信任等级
              </label>
              <Select name="trustLevel" defaultValue="2">
                <SelectTrigger id="trustLevel">
                  <div className="flex min-w-0 items-center gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                    <SelectValue placeholder="选择信任等级" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">TL0</SelectItem>
                  <SelectItem value="1">TL1</SelectItem>
                  <SelectItem value="2">TL2</SelectItem>
                  <SelectItem value="3">TL3</SelectItem>
                  <SelectItem value="4">TL4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="linuxdo" className="mt-1 w-full justify-center gap-2">
              <LinuxDoIcon size={16} />
              登录
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
