import { data } from "react-router";
import type { User } from "~/db/schema";
import { can, DAILY_LIMITS, denyReason, type Action } from "./permissions";
import { countSince } from "./queries.server";
import { requireUser } from "./session.server";

export async function requirePermission(request: Request, action: Action): Promise<User> {
  const user = await requireUser(request);
  if (!can(user, action)) throw data(denyReason(user, action), { status: 403 });
  return user;
}

/** Returns an error message when the user has used up today's quota. */
export async function dailyLimitError(user: User, kind: "submit" | "createPrompt") {
  if (user.role === "admin") return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await countSince(kind === "submit" ? "submissions" : "prompts", user.id, since);
  const limit = DAILY_LIMITS[kind];
  return used >= limit ? `24 小时内最多${kind === "submit" ? "提交" : "出题"} ${limit} 次` : null;
}

/** Author-only actions bypass trust-level gates but never bypass ownership. */
export function requireOwnership(user: User, authorId: number) {
  if (user.id !== authorId) throw data("只能操作自己的内容", { status: 403 });
}
