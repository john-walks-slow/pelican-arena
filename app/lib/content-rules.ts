export const CONTENT_RULES_REQUIRED_SECONDS = 5;

export interface ContentRuleItem {
  id: string;
  title: string;
  description: string;
}

export const CONTENT_RULES_TITLE = "内容规则";
export const CONTENT_RULES_SUBTITLE =
  "在 Pelican Arena 出题或作答，请共同遵守以下创作与竞技准则：";

export const CONTENT_RULES_ITEMS: readonly ContentRuleItem[] = [
  {
    id: "metadata",
    title: "真实客观",
    description: "如实标注实际运行的模型、提供方与推理档位。",
  },
  {
    id: "compliance",
    title: "内容合规",
    description: "严禁包含违法、色情、人身攻击、推广引流等违规内容。",
  },
  {
    id: "security",
    title: "安全底线",
    description: "严禁提交包含恶意跳转、试图逃逸沙箱或暗刷流量的代码。",
  },
  {
    id: "fairness",
    title: "公平竞技",
    description: "遵守题目设定的联网与外部库约束，禁止抄袭搬运他人作品。",
  },
];

export function hasAcceptedContentRules(
  user:
    | {
        rulesAcceptedAt?: Date | number | null;
        rulesAccepted?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (typeof user.rulesAccepted === "boolean") return user.rulesAccepted;
  return Boolean(user.rulesAcceptedAt);
}
