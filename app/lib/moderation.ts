import { SKIP_PROMPT_REVIEW_TRUST } from "./permissions";

export { SKIP_PROMPT_REVIEW_TRUST };

/**
 * Moderation vocabulary and pure rules, shared by the server, the admin UI and
 * the moderation API.
 */

export const PROMPT_STATUSES = ["pending", "active", "rejected", "removed"] as const;
export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/** `hidden` is an author withdrawal; `flagged` and `removed` come from moderation. */
export const SUBMISSION_STATUSES = ["active", "hidden", "flagged", "removed"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const REPORT_STATUSES = ["open", "accepted", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_TARGETS = ["prompt", "submission"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export interface ReportOption {
  id: string;
  label: string;
  description: string;
  /** Severe reports can hide the target automatically once enough pile up. */
  severe: boolean;
}

export const SUBMISSION_REPORT_REASONS = [
  {
    id: "metadata",
    label: "模型虚假或乱填",
    description: "明显伪造、偷换模型或随意胡乱填写（疑似降智或表现存疑请使用评分处的存疑功能）",
    severe: false,
  },
  {
    id: "malicious",
    label: "恶意行为或安全隐患",
    description: "包含试图逃逸沙箱、窃取信息、暗刷流量或恶意跳转的代码",
    severe: true,
  },
  {
    id: "abuse",
    label: "违规或不良内容",
    description: "包含违法信息、露骨色情、仇恨言论或人身攻击",
    severe: true,
  },
  {
    id: "spam",
    label: "垃圾信息或广告",
    description: "与作答无关的商业引流、推广链接或无意义灌水",
    severe: true,
  },
  {
    id: "offtopic",
    label: "与题目无关",
    description: "未按题目要求作答，或完全偏离主题",
    severe: false,
  },
  {
    id: "plagiarism",
    label: "抄袭已有答案",
    description: "未经重新生成，直接复制或搬运他人作品",
    severe: false,
  },
  {
    id: "other",
    label: "其他问题",
    description: "存在其他违反社区准则的情况（需详细说明）",
    severe: false,
  },
] as const satisfies readonly ReportOption[];

export const PROMPT_REPORT_REASONS = [
  {
    id: "abuse",
    label: "违规或不良内容",
    description: "包含违法信息、露骨色情、仇恨言论或人身攻击",
    severe: true,
  },
  {
    id: "spam",
    label: "垃圾信息或广告",
    description: "与作答无关的推广、引流链接或无意义灌水",
    severe: true,
  },
  {
    id: "unclear",
    label: "描述不清",
    description: "缺少目标或约束，无法据此产出可比较的作品",
    severe: false,
  },
  {
    id: "duplicate",
    label: "与已有题目重复",
    description: "与其他题目实质相同",
    severe: false,
  },
  {
    id: "unsuitable",
    label: "不适合作答",
    description: "需要外部资源，或结果无法横向比较",
    severe: false,
  },
  {
    id: "other",
    label: "其他问题",
    description: "存在其他违反社区准则的情况（需详细说明）",
    severe: false,
  },
] as const satisfies readonly ReportOption[];

export type ReportReason =
  | (typeof SUBMISSION_REPORT_REASONS)[number]["id"]
  | (typeof PROMPT_REPORT_REASONS)[number]["id"];

export const REPORT_REASON_IDS = [
  ...new Set([
    ...SUBMISSION_REPORT_REASONS.map((r) => r.id),
    ...PROMPT_REPORT_REASONS.map((r) => r.id),
  ]),
] as [ReportReason, ...ReportReason[]];

export function reportOptions(
  target: ReportTarget,
): readonly (ReportOption & { id: ReportReason })[] {
  return (
    target === "prompt" ? PROMPT_REPORT_REASONS : SUBMISSION_REPORT_REASONS
  ) as readonly (ReportOption & { id: ReportReason })[];
}

export function severeReasons(target: ReportTarget) {
  return reportOptions(target)
    .filter((r) => r.severe)
    .map((r) => r.id as ReportReason);
}

/** Distinct reporters with open severe reports needed to hide a target pending review. */
export const AUTO_HIDE_REPORTS = 3;
export const REPORT_NOTE_LIMIT = 500;
export const MODERATION_NOTE_LIMIT = 500;

export const ROUTING_REPORT_TIP =
  "关于模型真实性：本项仅用于处理明显伪造、欺骗、恶意偷换模型或随意乱填模型的行为。若仅怀疑服务商静默降级或对作答水平与真实性存疑，请使用评分处的「存疑」功能，无需提交举报。";

export const REJECT_REASONS = [
  { id: "unclear", label: "描述不清，无法据此作答" },
  { id: "duplicate", label: "与已有题目重复" },
  { id: "unsuitable", label: "不适合作答（违规、需要外部资源或结果无法比较）" },
  { id: "other", label: "其他" },
] as const;

export const reportReasonLabel = (id: string) =>
  [...SUBMISSION_REPORT_REASONS, ...PROMPT_REPORT_REASONS].find((r) => r.id === id)?.label ?? id;

export function isReportReason(value: unknown, target: ReportTarget): value is ReportReason {
  return typeof value === "string" && reportOptions(target).some((r) => r.id === value);
}

export function reportNeedsNote(reason: ReportReason) {
  return reason === "other";
}

/* ---------- transitions ---------- */

export const PROMPT_ACTIONS = ["approve", "reject", "remove", "restore"] as const;
export type PromptAction = (typeof PROMPT_ACTIONS)[number];

export const SUBMISSION_ACTIONS = ["keep", "remove", "restore"] as const;
export type SubmissionAction = (typeof SUBMISSION_ACTIONS)[number];

interface Transition<S extends string> {
  from: readonly S[];
  to: S;
  noteRequired: boolean;
}

export const PROMPT_TRANSITIONS: Record<PromptAction, Transition<PromptStatus>> = {
  approve: { from: ["pending"], to: "active", noteRequired: false },
  reject: { from: ["pending"], to: "rejected", noteRequired: true },
  remove: { from: ["active"], to: "removed", noteRequired: true },
  restore: { from: ["rejected", "removed"], to: "active", noteRequired: false },
};

/**
 * `keep` closes open reports and lifts an automatic hide; `remove` upholds them.
 * Author withdrawals (`hidden`) are left to the author.
 */
export const SUBMISSION_TRANSITIONS: Record<SubmissionAction, Transition<SubmissionStatus>> = {
  keep: { from: ["active", "flagged"], to: "active", noteRequired: false },
  remove: { from: ["active", "flagged", "hidden"], to: "removed", noteRequired: true },
  restore: { from: ["removed"], to: "active", noteRequired: false },
};

export function isPromptAction(value: unknown): value is PromptAction {
  return typeof value === "string" && (PROMPT_ACTIONS as readonly string[]).includes(value);
}

export function isSubmissionAction(value: unknown): value is SubmissionAction {
  return typeof value === "string" && (SUBMISSION_ACTIONS as readonly string[]).includes(value);
}

export function availablePromptActions(status: PromptStatus) {
  return PROMPT_ACTIONS.filter((a) => PROMPT_TRANSITIONS[a].from.includes(status));
}

export function availableSubmissionActions(status: SubmissionStatus) {
  return SUBMISSION_ACTIONS.filter((a) => SUBMISSION_TRANSITIONS[a].from.includes(status));
}

export const PROMPT_STATUS_LABELS: Record<PromptStatus, string> = {
  pending: "审核中",
  active: "公开",
  rejected: "未通过",
  removed: "已下架",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  active: "公开",
  hidden: "已撤回",
  flagged: "处理中",
  removed: "已下架",
};

export const MODERATION_ACTIONS = [
  "prompt_approve",
  "prompt_reject",
  "prompt_remove",
  "prompt_restore",
  "prompt_flag",
  "submission_keep",
  "submission_remove",
  "submission_restore",
  "submission_flag",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  prompt_approve: "通过题目",
  prompt_reject: "驳回题目",
  prompt_remove: "下架题目",
  prompt_restore: "恢复题目",
  prompt_flag: "自动隐藏题目",
  submission_keep: "保留答案",
  submission_remove: "下架答案",
  submission_restore: "恢复答案",
  submission_flag: "自动隐藏答案",
};

/* ---------- who sees what ---------- */

export interface Viewer {
  id: number;
  role: "user" | "admin";
  trustLevel: number;
}

export const isAdmin = (viewer: Pick<Viewer, "role"> | null | undefined) =>
  viewer?.role === "admin";

/**
 * New prompts publish straight away unless review is enabled, in which case
 * only admins and the trusted tier skip it.
 */
export function initialPromptStatus(
  author: Pick<Viewer, "role" | "trustLevel">,
  review: boolean,
): PromptStatus {
  if (!review) return "active";
  return isAdmin(author) || author.trustLevel >= SKIP_PROMPT_REVIEW_TRUST ? "active" : "pending";
}

export function canViewPrompt(
  viewer: Pick<Viewer, "id" | "role"> | null,
  prompt: { status: PromptStatus; authorId: number },
) {
  return prompt.status === "active" || isAdmin(viewer) || viewer?.id === prompt.authorId;
}

/** Public only when both the answer and its prompt are live; authors and admins always see it. */
export function isSubmissionPublic(status: SubmissionStatus, promptStatus: PromptStatus) {
  return status === "active" && promptStatus === "active";
}

export function canViewSubmission(
  viewer: Pick<Viewer, "id" | "role"> | null,
  submission: { status: SubmissionStatus; authorId: number },
  promptStatus: PromptStatus,
) {
  return (
    isSubmissionPublic(submission.status, promptStatus) ||
    isAdmin(viewer) ||
    viewer?.id === submission.authorId
  );
}

/** Auto-hide only applies to a live target; anything else needs a human. */
export function shouldAutoHide(
  status: PromptStatus | SubmissionStatus,
  severeReporters: number,
) {
  return status === "active" && severeReporters >= AUTO_HIDE_REPORTS;
}

/** Whether the usercontent origin may serve the files without a preview grant. */
export function isSubmissionServable(status: SubmissionStatus, promptStatus: PromptStatus) {
  return promptStatus === "active" && (status === "active" || status === "hidden");
}
