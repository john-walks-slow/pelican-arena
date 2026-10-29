import type { User } from "~/db/schema";

/** Linux DO trust levels required for each action. */
export const TRUST = {
  submit: 1,
  rate: 1,
  createPrompt: 2,
} as const;

export type Action = keyof typeof TRUST;

export const DAILY_LIMITS: Record<"submit" | "createPrompt", number> = {
  submit: 30,
  createPrompt: 5,
};

export function can(user: Pick<User, "trustLevel" | "silenced" | "role"> | null, action: Action) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return !user.silenced && user.trustLevel >= TRUST[action];
}

export function denyReason(user: Pick<User, "trustLevel" | "silenced"> | null, action: Action) {
  if (!user) return "请先登录";
  if (user.silenced) return "你的论坛账号处于禁言状态";
  return `需要信任等级 ${TRUST[action]} 及以上`;
}
