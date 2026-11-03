import {
  Code2,
  Download,
  ExternalLink,
  Eye,
  Maximize2,
  Pencil,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { data, Link, Outlet, redirect, useLocation, useNavigation, useSearchParams, useSubmit } from "react-router";
import type { Route } from "./+types/submission";
import { Avatar } from "~/components/avatar";
import { Markdown } from "~/components/markdown";
import { ModerationActions } from "~/components/moderation-actions";
import { PageHeader } from "~/components/page-header";
import { ReportDialog } from "~/components/report-dialog";
import { StatusBanner, SubmissionStatusBanner } from "~/components/status-banner";
import { LiveFrame } from "~/components/page-preview";
import { ShareDialog } from "~/components/share-dialog";
import { SourceViewer } from "~/components/source-viewer";
import { StarRating } from "~/components/star-rating";
import { StarScore } from "~/components/stars";
import { isValidRating } from "~/lib/rating";
import { ModTags } from "~/components/submission-tags";
import { Button } from "~/components/ui/button";
import { estimateCost, formatCost } from "~/lib/cost";
import { formatBytes } from "~/lib/bundle";
import { KIND_META } from "~/lib/kinds";
import { formatCount, formatDuration, formatRelative, REASONING_LABELS } from "~/lib/format";
import { backTarget, safeFrom, withFrom } from "~/lib/navigation";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { origins } from "~/lib/origins.server";
import { canViewSubmission, isAdmin } from "~/lib/moderation";
import { can, denyReason } from "~/lib/permissions";
import {
  clearRating,
  countOtherRatings,
  getPrompt,
  getSubmission,
  getUserRating,
  setRating,
} from "~/lib/queries.server";
import { cachedClientLoader, clearRouteCache, primeRouteCache } from "~/lib/route-cache";
import { submissionUrl, usercontentUrl } from "~/lib/sandbox";
import { previewGrantFor } from "~/lib/preview-grant.server";
import { hasReported } from "~/lib/moderation.server";
import { flashToast, getUser, requireUser } from "~/lib/session.server";
import { setSubmissionStatus } from "~/lib/submissions.server";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { LOG_SOURCE_LABELS, totalTokens } from "~/lib/session-log";
import { useOptionalUser } from "~/lib/use-user";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "找不到答案 · Pelican Arena" }];
  const { submission: s, prompt } = loaderData;
  const title = `${s.model.name} · ${s.provider.name} — ${prompt.title}`;
  return [
    { title: `${title} · Pelican Arena` },
    { property: "og:title", content: title },
    { property: "og:description", promptTitle: prompt.title, content: prompt.body.slice(0, 160) },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  const [prompt, user] = await Promise.all([getPrompt(submission.promptId), getUser(request)]);
  if (!prompt) throw data("Not Found", { status: 404 });
  if (
    !canViewSubmission(
      user,
      { status: submission.status, authorId: submission.author.id },
      prompt.status,
    )
  ) {
    throw data("Not Found", { status: 404 });
  }

  const isAuthor = user?.id === submission.author.id;
  const [myRating, otherRatings, reported, grant] = await Promise.all([
    user ? getUserRating(user.id, submission.id) : null,
    user?.id === submission.authorId
      ? countOtherRatings(submission.id, submission.authorId)
      : 0,
    user && !isAuthor ? hasReported(user.id, "submission", submission.id) : false,
    previewGrantFor({ id: submission.id, status: submission.status, promptStatus: prompt.status }),
  ]);
  return {
    submission,
    prompt: {
      id: prompt.id,
      title: prompt.title,
      body: prompt.body,
      kind: prompt.kind,
      status: prompt.status,
    },
    myRating,
    otherRatings,
    reported,
    grant,
    admin: isAdmin(user),
    usercontentOrigin: origins(request).usercontent,
    appOrigin: origins(request).app,
  };
}

export function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  return cachedClientLoader(request, serverLoader);
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  clearRouteCache();
  return serverAction();
}

export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "withdraw") {
    const user = await requireUser(request);
    const submission = await getSubmission(params.submissionId);
    if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
    const result = await setSubmissionStatus(submission.id, user.id, "hidden");
    if (result !== "ok") throw data("只能撤回自己的答案", { status: 403 });
    const from =
      safeFrom(String(form.get("from") ?? "")) ??
      safeFrom(new URL(request.url).searchParams.get("from"));
    return redirect(from ?? `/p/${submission.promptId}`, {
      headers: { "Set-Cookie": await flashToast(request, "答案已撤回") },
    });
  }

  const user = await requirePermission(request, "rate");
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  if (submission.authorId === user.id) throw data("不能给自己的答案打分", { status: 403 });

  const stars = Number(form.get("stars"));
  if (stars === 0) {
    await clearRating(user.id, submission.id);
  } else if (isValidRating(stars)) {
    // Only first-time votes consume the daily quota; edits stay free.
    const existing = await getUserRating(user.id, submission.id);
    if (!existing) {
      const limitError = await dailyLimitError(user, "rate");
      if (limitError) return data({ error: limitError }, { status: 429 });
    }
    await setRating(user.id, submission.id, stars);
  } else {
    throw data("Invalid rating", { status: 400 });
  }
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
  const {
    submission: s,
    prompt,
    myRating,
    otherRatings,
    reported,
    grant,
    admin,
    usercontentOrigin,
    appOrigin,
  } = loaderData;
  const user = useOptionalUser();
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();

  useEffect(() => {
    primeRouteCache(`${pathname}${search}`, loaderData);
  }, [pathname, search, loaderData]);
  const navigation = useNavigation();
  const submit = useSubmit();
  const from = params.get("from");
  const back = backTarget(from, { label: prompt.title, to: `/p/${prompt.id}` });
  const query = params.toString();
  const here = `/s/${s.id}${query ? `?${query}` : ""}`;
  const editHref = withFrom(`/s/${s.id}/edit`, here);
  const promptHref = withFrom(`/p/${prompt.id}`, here);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const kind = prompt.kind;
  const pageUrl = submissionUrl(usercontentOrigin, s.id, kind, grant);
  const baseUrl = usercontentUrl(usercontentOrigin, s.id, "", grant);
  const log = s.logMeta;
  const estimatedCost = log ? estimateCost(log, s.model.cost) : null;
  const isAuthor = user?.id === s.author.id;
  const editable = isAuthor;

  const live = s.status === "active" && prompt.status === "active";
  const ratingBlock = !live
    ? "答案未公开，暂不能打分"
    : isAuthor
      ? "这是你提交的答案"
      : undefined;
  const showReport = Boolean(!isAuthor);

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader
        back={{
          to: back.to,
          label: back.label,
          trail:
            back.label !== prompt.title
              ? { to: promptHref, label: prompt.title }
              : undefined,
        }}
        title={s.model.name}
        subtitle={
          <>
            {s.provider.name}
            {s.harness && ` · ${s.harness.name}`}
          </>
        }
        actions={
          <>
            {editable && (
              <Button
                asChild
                variant="outline"
                className="header-collapse-fade gap-1.5"
              >
                <Link to={editHref} preventScrollReset>
                  <Pencil className="size-4 text-muted" strokeWidth={1.75} />
                  编辑
                </Link>
              </Button>
            )}
            {admin && s.status === "active" && (
              <ModerationActions
                kind="submission"
                id={s.id}
                status={s.status}
                excludeActions={["keep"]}
                className="header-collapse-fade"
              />
            )}
            <ShareDialog
              path={`/s/${s.id}`}
              title={`${s.model.name} · ${s.provider.name} — ${prompt.title}`}
              appOrigin={appOrigin}
              cardData={{
                type: "answer",
                promptTitle: prompt.title,
                modelName: s.model.name,
                providerName: s.provider.name,
                harnessName: s.harness?.name,
                kind: prompt.kind,
                previewUrl: pageUrl,
                starSum: s.starSum,
                votes: s.votes,
              }}
            />
            <Button asChild variant="outline" className="gap-1.5">
              <a href={pageUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" strokeWidth={1.75} />
                新标签页打开
              </a>
            </Button>
          </>
        }
      />

      {prompt.status !== "active" && (
        <StatusBanner
          tone="muted"
          title="所属题目暂未公开"
          detail={
            prompt.status === "pending"
              ? "题目通过审核后，这份答案才会出现在列表里。"
              : "题目未通过审核，答案暂不公开。"
          }
        />
      )}

      {s.status !== "active" && (
        <SubmissionStatusBanner status={s.status} note={s.moderationNote}>
          {admin && <ModerationActions kind="submission" id={s.id} status={s.status} />}
        </SubmissionStatusBanner>
      )}

      <div className="mt-2.5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="reveal-tier-1 min-w-0 overflow-hidden rounded-card border border-border bg-surface">
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
            <div
              id="work-panel"
              className="h-[min(74vh,860px)] bg-surface"
            >
              {kind === "web" ? (
                <LiveFrame src={pageUrl} title={`${s.model.name} 的答案`} className="size-full" />
              ) : kind === "svg" ? (
                <div className="flex size-full items-center justify-center bg-white p-4">
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
            <SourceViewer files={s.files} baseUrl={baseUrl} />
          )}
        </section>

        <aside className="reveal-tier-2 space-y-5">
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
              <MetaRow label="思考强度">{s.reasoning ? REASONING_LABELS[s.reasoning] : "Default"}</MetaRow>
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
                {estimatedCost != null && (
                  <MetaRow label="预估成本">
                    <span className="num font-medium text-ink">{formatCost(estimatedCost)}</span>
                  </MetaRow>
                )}
                <MetaRow label="用时">{log.durationMs == null ? "—" : formatDuration(log.durationMs)}</MetaRow>
                <MetaRow label="轮数 / 工具调用">
                  {Math.max(log.turns, 1)} / {log.toolCalls}
                </MetaRow>
              </dl>
            </SideSection>
          )}

          <SideSection title="提交者">
            <div className="flex items-center gap-2.5">
              <Avatar template={s.author.avatarTemplate} username={s.author.username} size={24} />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{s.author.username}</div>
                <div className="text-[11px] text-muted" suppressHydrationWarning>
                  {formatRelative(s.createdAt)}
                  {s.updatedAt && " · 已编辑"}
                </div>
              </div>
            </div>
            {isAuthor && (
              <div className="mt-2.5 border-t border-rule pt-2.5 text-xs text-muted">
                <p>可以随时编辑生成信息、日志统计与备注；如需更换作品请撤回后重新提交。</p>
                <button
                  type="button"
                  onClick={() => setWithdrawOpen(true)}
                  className="mt-1.5 inline-flex items-center gap-1 text-muted hover:text-negative"
                >
                  <Undo2 className="size-3.5" strokeWidth={1.75} />
                  撤回这份答案
                </button>
              </div>
            )}
            {s.notes && (
              <p className="mt-2.5 border-t border-rule pt-2.5 text-xs whitespace-pre-wrap text-muted">
                {s.notes}
              </p>
            )}
            {showReport && live && (
              <div className="mt-2.5 border-t border-border pt-2.5">
                <ReportDialog
                  target="submission"
                  targetId={s.id}
                  reported={reported}
                />
              </div>
            )}
          </SideSection>
        </aside>
      </div>

      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="撤回这份答案？"
        description="撤回后会从题目页与统计中消失。文件与评分记录会保留，你可以在「我的」里恢复。"
        confirmLabel="撤回"
        destructive
        busy={navigation.state !== "idle"}
        onConfirm={() => {
          submit({ intent: "withdraw", from: from ?? "" }, { method: "post" });
        }}
      />

      <Outlet />
    </div>
  );
}
