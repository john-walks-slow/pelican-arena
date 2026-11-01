import { AlertTriangle, Clock, EyeOff } from "lucide-react";
import type { PromptStatus, SubmissionStatus } from "~/lib/moderation";
import { cn } from "~/lib/utils";

type Tone = "pending" | "negative" | "muted";

const TONES: Record<Tone, string> = {
  pending: "border-pill-warning-ink/15 bg-pill-warning text-pill-warning-ink",
  negative: "border-negative/15 bg-pill-negative text-pill-negative-ink",
  muted: "border-border bg-raised text-muted",
};

const ICONS = { pending: Clock, negative: AlertTriangle, muted: EyeOff };

export function StatusBanner({
  tone,
  title,
  detail,
  children,
}: {
  tone: Tone;
  title: string;
  detail?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-start gap-2.5 rounded-card border px-3.5 py-3 text-[13px]",
        TONES[tone],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {detail && <p className="mt-0.5 leading-relaxed opacity-80">{detail}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

const PROMPT_COPY: Record<Exclude<PromptStatus, "active">, { tone: Tone; title: string }> = {
  pending: { tone: "pending", title: "题目正在审核" },
  rejected: { tone: "negative", title: "题目未通过审核" },
  removed: { tone: "negative", title: "题目已被下架" },
};

export function PromptStatusBanner({
  status,
  note,
  children,
}: {
  status: Exclude<PromptStatus, "active">;
  note?: string | null;
  children?: React.ReactNode;
}) {
  const copy = PROMPT_COPY[status];
  const detail =
    status === "pending"
      ? "审核通过后将公开并开放作答。"
      : note
        ? `原因：${note}`
        : undefined;
  return (
    <StatusBanner tone={copy.tone} title={copy.title} detail={detail}>
      {children}
    </StatusBanner>
  );
}

const SUBMISSION_COPY: Record<Exclude<SubmissionStatus, "active">, { tone: Tone; title: string }> = {
  hidden: { tone: "muted", title: "答案已撤回" },
  flagged: { tone: "pending", title: "作品暂时不可见" },
  removed: { tone: "negative", title: "作品已被下架" },
};

export function SubmissionStatusBanner({
  status,
  note,
  children,
}: {
  status: Exclude<SubmissionStatus, "active">;
  note?: string | null;
  children?: React.ReactNode;
}) {
  const copy = SUBMISSION_COPY[status];
  const detail =
    status === "hidden"
      ? "它仍可通过直链打开，但不会出现在公开列表和评测统计中。"
      : note
        ? `原因：${note}`
        : status === "flagged"
          ? "该作品因收到反馈已被暂时隐藏，管理团队正在复核。"
          : undefined;
  return (
    <StatusBanner tone={copy.tone} title={copy.title} detail={detail}>
      {children}
    </StatusBanner>
  );
}
