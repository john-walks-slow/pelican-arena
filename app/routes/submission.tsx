import {
  ArrowLeft,
  Code2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Maximize2,
} from "lucide-react";
import { useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/submission";
import { Avatar } from "~/components/avatar";
import { Markdown } from "~/components/markdown";
import { LiveFrame } from "~/components/page-preview";
import { SourceViewer } from "~/components/source-viewer";
import { StarRating } from "~/components/star-rating";
import { StarScore } from "~/components/stars";
import { ModTags } from "~/components/submission-tags";
import { Button } from "~/components/ui/button";
import { formatBytes } from "~/lib/bundle";
import { KIND_META } from "~/lib/kinds";
import { formatCount, formatDuration, formatRelative, REASONING_LABELS } from "~/lib/format";
import { requirePermission } from "~/lib/guards.server";
import { origins } from "~/lib/origins.server";
import { can, denyReason } from "~/lib/permissions";
import { clearRating, getPrompt, getSubmission, getUserRating, setRating } from "~/lib/queries.server";
import { submissionUrl, usercontentUrl } from "~/lib/sandbox";
import { getUser } from "~/lib/session.server";
import { LOG_SOURCE_LABELS, totalTokens } from "~/lib/session-log";
import { useOptionalUser } from "~/lib/use-user";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "找不到答案 · Pelican Arena" }];
  const { submission: s, prompt } = loaderData;
  const title = `${s.model.name} · ${s.provider.name} — ${prompt.title}`;
  return [
    { title: `${title} · Pelican Arena` },
    { property: "og:title", content: title },
    { property: "og:description", content: prompt.body.slice(0, 160) },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  const [prompt, user] = await Promise.all([getPrompt(submission.promptId), getUser(request)]);
  if (!prompt) throw data("Not Found", { status: 404 });
  const myRating = user ? await getUserRating(user.id, submission.id) : null;
  return {
    submission,
    prompt: { id: prompt.id, title: prompt.title, body: prompt.body, kind: prompt.kind },
    myRating,
    usercontentOrigin: origins(request).usercontent,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requirePermission(request, "rate");
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  if (submission.authorId === user.id) throw data("不能给自己的答案打分", { status: 403 });

  const form = await request.formData();
  const stars = Number(form.get("stars"));
  if (stars === 0) await clearRating(user.id, submission.id);
  else if (Number.isInteger(stars) && stars >= 1 && stars <= 5) await setRating(user.id, submission.id, stars);
  else throw data("Invalid rating", { status: 400 });
  return { stars };
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="num min-w-0 text-right">{children}</dd>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-sm font-semibold">{title}</h2>
      <div className="rounded-card border border-border bg-surface px-3.5 py-3 text-sm">{children}</div>
    </section>
  );
}

async function downloadZip(baseUrl: string, paths: string[], name: string) {
  const { zipSync } = await import("fflate");
  const entries = await Promise.all(
    paths.map(async (p) => [p, new Uint8Array(await (await fetch(`${baseUrl}${p}`)).arrayBuffer())] as const),
  );
  const blob = new Blob([zipSync(Object.fromEntries(entries)) as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.zip` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubmissionPage({ loaderData }: Route.ComponentProps) {
  const { submission: s, prompt, myRating, usercontentOrigin } = loaderData;
  const user = useOptionalUser();
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const kind = prompt.kind;
  const pageUrl = submissionUrl(usercontentOrigin, s.id, kind);
  const baseUrl = usercontentUrl(usercontentOrigin, s.id);
  const log = s.logMeta;

  const ratingBlock = !user
    ? "登录后可打分"
    : user.id === s.author.id
      ? "这是你提交的答案"
      : !can(user, "rate")
        ? denyReason(user, "rate")
        : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link
        to={`/p/${prompt.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        {prompt.title}
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title font-bold tracking-tight">{s.model.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {s.provider.name}
            {s.harness && ` · ${s.harness.name}`}
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <a href={pageUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" strokeWidth={1.75} />
            新标签页打开
          </a>
        </Button>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex h-10 items-center border-b border-border px-1.5">
            {(
              [
                ["preview", <Eye key="e" className="size-3.5" strokeWidth={1.75} />, "预览"],
                [
                  "source",
                  <Code2 key="c" className="size-3.5" strokeWidth={1.75} />,
                  s.files.length > 1 ? `源码 ${s.files.length}` : "源码",
                ],
              ] as const
            ).map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-xs transition-colors ${
                  tab === value
                    ? "border-accent font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-0.5 pr-1">
              {tab === "preview" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="全屏"
                  title="全屏"
                  onClick={() => document.getElementById("work-panel")?.requestFullscreen()}
                >
                  <Maximize2 className="size-3.5" strokeWidth={1.75} />
                </Button>
              ) : kind === "web" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => downloadZip(baseUrl, s.files.map((f) => f.path), s.id)}
                >
                  <Download className="size-3.5" strokeWidth={1.75} />
                  下载 zip
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm" className="gap-1.5">
                  <a href={`/s/${s.id}/download`}>
                    <Download className="size-3.5" strokeWidth={1.75} />
                    下载 .{KIND_META[kind].extension}
                  </a>
                </Button>
              )}
            </div>
          </div>
          {tab === "preview" ? (
            <div id="work-panel" className="h-[min(74vh,860px)] bg-white panel-fade">
              {kind === "web" ? (
                <LiveFrame src={pageUrl} title={`${s.model.name} 的答案`} className="size-full" />
              ) : kind === "svg" ? (
                <div className="flex size-full items-center justify-center p-4">
                  <img
                    src={pageUrl}
                    alt={`${s.model.name} 的答案`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="size-full overflow-y-auto scroll-thin px-6 py-6">
                  <Markdown>{s.content ?? ""}</Markdown>
                </div>
              )}
            </div>
          ) : (
            <div className="panel-fade">
              <SourceViewer files={s.files} baseUrl={baseUrl} />
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <SideSection title="评分">
            <div className="mb-2.5">
              <StarScore starSum={s.starSum} votes={s.votes} />
            </div>
            <StarRating current={myRating} disabledReason={ratingBlock} />
          </SideSection>

          <SideSection title="生成信息">
            <dl className="divide-y divide-rule text-[13px]">
              <MetaRow label="类型">{KIND_META[kind].label}</MetaRow>
              <MetaRow label="模型">{s.model.name}</MetaRow>
              <MetaRow label="提供方">{s.provider.name}</MetaRow>
              <MetaRow label="客户端">{s.harness?.name ?? "—"}</MetaRow>
              <MetaRow label="思考强度">{s.reasoning ? REASONING_LABELS[s.reasoning] : "默认"}</MetaRow>
              <MetaRow label="增强">
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <ModTags mods={s.mods} />
                </span>
              </MetaRow>
              <MetaRow label="大小">{formatBytes(s.totalBytes)}</MetaRow>
            </dl>
          </SideSection>

          {log && (
            <SideSection title={`Session log · ${LOG_SOURCE_LABELS[log.source]}`}>
              <dl className="divide-y divide-rule text-[13px]">
                <MetaRow label="日志中的模型">{log.models.join("、") || "—"}</MetaRow>
                <MetaRow label="总 token">{formatCount(totalTokens(log))}</MetaRow>
                <MetaRow label="输入 / 输出">
                  {formatCount(log.inputTokens)} / {formatCount(log.outputTokens)}
                </MetaRow>
                <MetaRow label="缓存读取 / 写入">
                  {formatCount(log.cacheReadTokens)} / {formatCount(log.cacheWriteTokens)}
                </MetaRow>
                <MetaRow label="用时">{log.durationMs == null ? "—" : formatDuration(log.durationMs)}</MetaRow>
                <MetaRow label="轮数 / 工具调用">
                  {log.turns} / {log.toolCalls}
                </MetaRow>
              </dl>
              {s.hasRawLog && (
                <a
                  href={`/s/${s.id}/log`}
                  download
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
                >
                  <FileText className="size-3.5" strokeWidth={1.75} />
                  下载原始日志
                </a>
              )}
            </SideSection>
          )}

          <SideSection title="提交者">
            <div className="flex items-center gap-2.5">
              <Avatar template={s.author.avatarTemplate} username={s.author.username} size={24} />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{s.author.username}</div>
                <div className="text-[11px] text-muted">{formatRelative(s.createdAt)}</div>
              </div>
            </div>
            {s.notes && (
              <p className="mt-2.5 border-t border-rule pt-2.5 text-xs whitespace-pre-wrap text-muted">
                {s.notes}
              </p>
            )}
          </SideSection>
        </aside>
      </div>
    </div>
  );
}
