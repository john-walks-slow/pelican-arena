import { redirect } from "react-router";
import type { Route } from "./+types/auth.logout";
import { destroySession, getSession } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  return redirect("/", { headers: { "Set-Cookie": await destroySession(session) } });
}

export const loader = () => redirect("/");
