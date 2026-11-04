import type { User } from "~/db/schema";

/** Linux DO trust levels required for each action. */
export const TRUST = {
  submit: 1,
  rate: 1,
  report: 1,
  createPrompt: 2,
} as const;

/** Trust level at which new prompts skip review when prompt review is on. */
export const SKIP_PROMPT_REVIEW_TRUST = 3;

export type Action = keyof typeof TRUST;

export type LimitedAction = "createPrompt" | "submit" | "rate" | "report";

/** Per-user ceiling in a rolling 24 hours. Rating counts new ratings only. */
export const DAILY_LIMITS: Record<LimitedAction, number> = {
  createPrompt: 5,
  submit: 20,
  rate: 50,
  report: 20,
};

/** Which table each quota counts. */
export const LIMIT_TABLES: Record<
  LimitedAction,
  "prompts" | "submissions" | "ratings" | "reports"
> = {
  createPrompt: "prompts",
  submit: "submissions",
  rate: "ratings",
  report: "reports",
};

export const LIMIT_NOUNS: Record<LimitedAction, string> = {
  createPrompt: "出题",
  submit: "提交",
  rate: "评分",
  report: "举报",
};

export const ACTION_LABELS: Record<Action, string> = {
  createPrompt: "出题",
  submit: "提交答案",
  rate: "评分",
  report: "举报",
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
