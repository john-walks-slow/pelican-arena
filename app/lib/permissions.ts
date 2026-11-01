import type { User } from "~/db/schema";

/** Linux DO trust levels required for each action. */
export const TRUST = {
  submit: 1,
  rate: 1,
  report: 1,
  createPrompt: 2,
} as const;

/** Trust level at which new prompts are published without review. */
export const SKIP_PROMPT_REVIEW_TRUST = 3;

export type Action = keyof typeof TRUST;

export type LimitedAction = "submit" | "createPrompt" | "report";

export const DAILY_LIMITS: Record<LimitedAction, number> = {
  submit: 30,
  createPrompt: 5,
  report: 20,
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
