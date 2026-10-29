import { ArrowLeft, Download, ExternalLink, FileText, Maximize2 } from "lucide-react";
import { useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/submission";
import { Avatar } from "~/components/avatar";
import { LiveFrame } from "~/components/page-preview";
import { SourceViewer } from "~/components/source-viewer";
import { StarRating } from "~/components/star-rating";
import { StarScore } from "~/components/stars";
import { AttemptTag, ModTags } from "~/components/submission-tags";
import { formatBytes } from "~/lib/bundle";
import { formatCount, formatDuration, formatRelative, REASONING_LABELS } from "~/lib/format";
import { origins } from "~/lib/origins.server";
import { can, denyReason } from "~/lib/permissions";
import { clearRating, getPrompt, getSubmission, getUserRating, setRating } from "~/lib/queries.server";
import { usercontentUrl } from "~/lib/sandbox";
import { requirePermission } from "~/lib/guards.server";
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
    prompt: { id: prompt.id, title: prompt.title, body: prompt.body },
    myRating,
    usercontentOrigin: origins().usercontent,
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
  return { ok: true };
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="num min-w-0 text-right">{children}</dd>
    </div>
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
  const pageUrl = usercontentUrl(usercontentOrigin, s.id);
  const log = s.logMeta;

  const ratingBlock = !user
    ? "登录后可以打分"
    : user.id === s.author.id
      ? "这是你提交的答案"
      : !can(user, "rate")
        ? denyReason(user, "rate")
        : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link to={`/p/${prompt.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        {prompt.title}
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title font-bold tracking-tight">{s.model.name}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {s.provider.name}
            {s.harness && ` · ${s.harness.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={pageUrl} target="_blank" rel="noreferrer" className="btn-outline">
            <ExternalLink className="size-4" strokeWidth={1.75} />
            新标签页打开
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex h-11 items-center gap-1 border-b border-border px-2">
            {(["preview", "source"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-11 border-b-2 px-3 text-sm ${
                  tab === t ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t === "preview" ? "预览" : `源码 · ${s.files.length} 个文件`}
              </button>
            ))}
            {tab === "preview" && (
              <button
                type="button"
                className="btn-ghost ml-auto size-8 px-0"
                aria-label="全屏"
                title="全屏"
                onClick={() => document.getElementById("live-frame")?.requestFullscreen()}
              >
                <Maximize2 className="size-4" strokeWidth={1.75} />
              </button>
            )}
            {tab === "source" && (
              <button
                type="button"
                className="btn-ghost ml-auto"
                onClick={() => downloadZip(pageUrl, s.files.map((f) => f.path), s.id)}
              >
                <Download className="size-4" strokeWidth={1.75} />
                下载 zip
              </button>
            )}
          </div>
          {tab === "preview" ? (
            <div id="live-frame" className="h-[min(72vh,820px)] bg-white">
              <LiveFrame src={pageUrl} title={`${s.model.name} 的答案`} className="size-full" />
            </div>
          ) : (
            <SourceViewer files={s.files} baseUrl={pageUrl} />
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">评分</h2>
            <div className="panel space-y-3 p-4">
              <StarScore starSum={s.starSum} votes={s.votes} />
              <StarRating current={myRating} disabledReason={ratingBlock} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">生成方式</h2>
            <dl className="panel divide-y divide-rule px-4 text-sm">
              <MetaRow label="模型">{s.model.name}</MetaRow>
              <MetaRow label="提供方">{s.provider.name}</MetaRow>
              <MetaRow label="客户端">{s.harness?.name ?? "—"}</MetaRow>
              <MetaRow label="思考强度">{s.reasoning ? REASONING_LABELS[s.reasoning] : "—"}</MetaRow>
              <MetaRow label="增强">
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <ModTags mods={s.mods} />
                </span>
              </MetaRow>
              <MetaRow label="生成次数">
                {s.attempt === "first" ? "第一次生成" : <AttemptTag attempt={s.attempt} count={s.attemptCount} />}
              </MetaRow>
              <MetaRow label="大小">{formatBytes(s.totalBytes)}</MetaRow>
            </dl>
          </section>

          {log && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Session log
                <span className="ml-1.5 font-normal text-muted">{LOG_SOURCE_LABELS[log.source]}</span>
              </h2>
              <dl className="panel divide-y divide-rule px-4 text-sm">
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
                <a href={`/s/${s.id}/log`} className="btn-ghost mt-2" download>
                  <FileText className="size-4" strokeWidth={1.75} />
                  下载原始日志
                </a>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold">提交者</h2>
            <div className="panel space-y-3 p-4">
              <div className="flex items-center gap-2.5 text-sm">
                <Avatar template={s.author.avatarTemplate} username={s.author.username} size={28} />
                <div>
                  <div className="font-medium">{s.author.username}</div>
                  <div className="text-xs text-muted">{formatRelative(s.createdAt)}</div>
                </div>
              </div>
              {s.notes && <p className="text-sm whitespace-pre-wrap">{s.notes}</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
