import type { Route } from "./+types/api.admin.prompts";
import { requireAdmin } from "~/lib/guards.server";
import { listPendingPrompts } from "~/lib/moderation.server";

/** Continuation page for the pending-prompt queue. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const requested = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  return listPendingPrompts(page);
}
