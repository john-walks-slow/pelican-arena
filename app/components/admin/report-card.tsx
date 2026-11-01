import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { Avatar } from "~/components/avatar";
import { ModerationActions } from "~/components/moderation-actions";
import { SubmissionPreview } from "~/components/submission-preview";
import { formatRelative } from "~/lib/format";
import type { PromptStatus, ReportReason, SubmissionStatus } from "~/lib/moderation";
import { KIND_META } from "~/lib/kinds";
import { reportReasonLabel } from "~/lib/moderation";

export interface ReportEntryData {
  id: string;
  reason: ReportReason;
  note: string | null;
  createdAt: Date;
  reporter: { id: number; username: string; avatarTemplate: string | null };
}

interface ReportGroupBase {
  reports: ReportEntryData[];
  firstReportAt: Date;
}

export interface SubmissionReportGroup extends ReportGroupBase {
  targetType: "submission";
  submission: {
    id: string;
    status: SubmissionStatus;
    createdAt: Date;
    model: string;
    provider: string;
    promptId: string;
    promptTitle: string;
    promptStatus: PromptStatus;
    kind: "web" | "markdown" | "svg";
    author: { id: number; username: string; avatarTemplate: string | null };
  };
  /** Signed preview path for answers that are no longer public. */
  grant: string | null;
}

export interface PromptReportGroup extends ReportGroupBase {
  targetType: "prompt";
  prompt: {
    id: string;
    status: PromptStatus;
    createdAt: Date;
    title: string;
    kind: "web" | "markdown" | "svg";
    excerpt: string;
    author: { id: number; username: string; avatarTemplate: string | null };
  };
}

export type ReportGroupData = SubmissionReportGroup | PromptReportGroup;

const SUBMISSION_PILL: Partial<Record<SubmissionStatus, { label: string; className: string }>> = {
  flagged: { label: "已自动隐藏", className: "bg-pill-warning text-pill-warning-ink" },
  removed: { label: "已下架", className: "bg-pill-negative text-pill-negative-ink" },
  hidden: { label: "作者已撤回", className: "bg-raised text-muted" },
};

const PROMPT_PILL: Partial<Record<PromptStatus, { label: string; className: string }>> = {
  pending: { label: "已自动隐藏", className: "bg-pill-warning text-pill-warning-ink" },
  removed: { label: "已下架", className: "bg-pill-negative text-pill-negative-ink" },
  rejected: { label: "未通过", className: "bg-pill-negative text-pill-negative-ink" },
};

function reasonSummary(reports: ReportEntryData[]) {
  const counts = new Map<string, number>();
  for (const r of reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reportReasonLabel(reason)} ×${n}`)
    .join(" · ");
}

function Notes({ reports }: { reports: ReportEntryData[] }) {
  const notes = reports.filter((r) => r.note);
  if (notes.length === 0) return null;
  return (
    <details className="group mt-2 rounded-control bg-raised/60 px-2.5 py-2 text-xs" open={notes.length <= 2}>
      <summary className="cursor-pointer list-none text-muted marker:hidden group-open:mb-1.5">
        补充说明 {notes.length} 条
      </summary>
      <ul className="space-y-1.5">
        {notes.map((r) => (
          <li key={r.id} className="leading-relaxed">
            <span className="text-muted">
              {r.reporter.username} · {formatRelative(r.createdAt)}
            </span>
            <br />
            <span className="whitespace-pre-wrap">{r.note}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Meta({ reports, firstReportAt }: { reports: ReportEntryData[]; firstReportAt: Date }) {
  return (
    <>
      <p className="mt-2 text-xs text-ink">{reasonSummary(reports)}</p>
      <p className="mt-1 text-[11px] text-muted">最先举报 {formatRelative(firstReportAt)}</p>
    </>
  );
}

function SubmissionCard({
  group,
  usercontentOrigin,
}: {
  group: SubmissionReportGroup;
  usercontentOrigin: string;
}) {
  const { submission, reports, grant } = group;
  const pill = SUBMISSION_PILL[submission.status];

  return (
    <article className="rounded-card border border-border bg-surface">
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row">
        <Link
          to={`/s/${submission.id}`}
          className="w-full shrink-0 overflow-hidden rounded-control border border-border sm:w-[176px]"
          aria-label="打开答案"
        >
          <SubmissionPreview
            kind={submission.kind}
            submissionId={submission.id}
            origin={usercontentOrigin}
            grant={grant}
            title={submission.model}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{submission.model}</span>
            <span className="text-xs text-muted">{submission.provider}</span>
            {pill && (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${pill.className}`}>
                {pill.label}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <Link to={`/p/${submission.promptId}`} className="hover:text-ink">
              {submission.promptTitle}
            </Link>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Avatar
                template={submission.author.avatarTemplate}
                username={submission.author.username}
                size={14}
              />
              {submission.author.username}
            </span>
          </div>

          <Meta reports={reports} firstReportAt={group.firstReportAt} />
          <Notes reports={reports} />
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
        <Link
          to={`/s/${submission.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
          打开答案
        </Link>
        <ModerationActions kind="submission" id={submission.id} status={submission.status} />
      </footer>
    </article>
  );
}

function PromptCard({ group }: { group: PromptReportGroup }) {
  const { prompt, reports } = group;
  const pill = PROMPT_PILL[prompt.status];

  return (
    <article className="rounded-card border border-border bg-surface">
      <div className="p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted">
            {KIND_META[prompt.kind].label}
          </span>
          <Link to={`/p/${prompt.id}`} className="text-sm font-semibold hover:text-accent-ink">
            {prompt.title}
          </Link>
          {pill && (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${pill.className}`}>
              {pill.label}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Avatar
              template={prompt.author.avatarTemplate}
              username={prompt.author.username}
              size={14}
            />
            {prompt.author.username}
          </span>
          <span>·</span>
          <span>{formatRelative(prompt.createdAt)}</span>
        </div>

        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">{prompt.excerpt}</p>

        <Meta reports={reports} firstReportAt={group.firstReportAt} />
        <Notes reports={reports} />
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
        <Link
          to={`/p/${prompt.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
          打开题目
        </Link>
        <ModerationActions kind="prompt" id={prompt.id} status={prompt.status} />
      </footer>
    </article>
  );
}

export function ReportCard({
  group,
  usercontentOrigin,
}: {
  group: ReportGroupData;
  usercontentOrigin: string;
}) {
  return group.targetType === "prompt" ? (
    <PromptCard group={group} />
  ) : (
    <SubmissionCard group={group} usercontentOrigin={usercontentOrigin} />
  );
}
