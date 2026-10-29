import { data } from "react-router";
import type { Route } from "./+types/api.mine.prompts";
import { listOwnPrompts } from "~/lib/queries.server";
import { getUser } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) return data({ error: "请先登录" }, { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  return listOwnPrompts(user.id, page);
}
