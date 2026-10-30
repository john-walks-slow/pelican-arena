import { Loader2, PenLine, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { data, Link, useFetcher } from "react-router";
import type { Route } from "./+types/me";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { LoadMore } from "~/components/load-more";
import { PageHeader } from "~/components/page-header";
import { StarScore } from "~/components/stars";
import { SubmissionPreview } from "~/components/submission-preview";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toaster";
import { formatRelative } from "~/lib/format";
import { KIND_META } from "~/lib/kinds";
import { withFrom } from "~/lib/navigation";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import {
  deletePrompt,
  listOwnPrompts,
  listOwnSubmissions,
  ownContentCounts,
} from "~/lib/queries.server";
import { setSubmissionStatus } from "~/lib/submissions.server";
import { requireUser } from "~/lib/session.server";

type PromptRow = Awaited<ReturnType<typeof listOwnPrompts>>["prompts"][number];
type AnswerRow = Awaited<ReturnType<typeof listOwnSubmissions>>["submissions"][number];
type ActionResult = { ok: true; message: string } | { error: string };

export function meta() {
  return [{ title: "我的 · Pelican Arena" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") === "answers" ? "answers" : "prompts";
  const requested = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  const counts = await ownContentCounts(user.id);
  const shared = {
    counts,
    canCreate: can(user, "createPrompt"),
    usercontentOrigin: origins(request).usercontent,
  };
  if (tab === "answers") {
    return { ...shared, tab: "answers" as const, result: await listOwnSubmissions(user.id, page) };
  }
  return { ...shared, tab: "prompts" as const, result: await listOwnPrompts(user.id, page) };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "").trim();
  if (!id) return data({ error: "缺少内容 id" }, { status: 400 });

  if (intent === "deletePrompt") {
    const result = await deletePrompt(id, user.id);
    if (result === "ok") return { ok: true as const, message: "题目已删除" };
    if (result === "not_found") return data({ error: "题目不存在" }, { status: 404 });
    if (result === "forbidden") return data({ error: "只能删除自己的题目" }, { status: 403 });
    return data({ error: "已有答案的题目不能删除" }, { status: 409 });
  }

  if (intent === "withdrawAnswer" || intent === "restoreAnswer") {
    const result = await setSubmissionStatus(
      id,
      user.id,
      intent === "withdrawAnswer" ? "hidden" : "active",
    );
    if (result === "ok") {
      return {
        ok: true as const,
        message: intent === "withdrawAnswer" ? "答案已撤回" : "答案已恢复",
      };
    }
    if (result === "not_found") return data({ error: "答案不存在" }, { status: 404 });
    return data({ error: "只能操作自己的答案" }, { status: 403 });
  }

  return data({ error: "未知操作" }, { status: 400 });
}

interface PendingAction {
  intent: "deletePrompt" | "withdrawAnswer" | "restoreAnswer";
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
}

function TabLink({
  to,
  active,
  label,
  count,
}: {
  to: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors ${
        active
          ? "border-ink font-medium text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`num rounded-full px-1.5 py-0.5 text-[11px] ${
          active ? "bg-raised text-ink" : "bg-raised/60 text-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function PromptRowItem({
  prompt,
  from,
  onDelete,
}: {
  prompt: PromptRow;
  from: string;
  onDelete: (pending: PendingAction) => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-raised/30 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted">
            {KIND_META[prompt.kind].label}
          </span>
          <Link
            to={withFrom(`/p/${prompt.id}`, from)}
            className="truncate text-[15px] font-semibold tracking-tight hover:text-accent-ink"
          >
            {prompt.title}
          </Link>
          {prompt.status === "hidden" && (
            <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted">
              已隐藏
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="num">{prompt.answers} 份答案</span>
          <span>·</span>
          <StarScore starSum={prompt.starSum} votes={prompt.votes} />
          <span>·</span>
          <span>{formatRelative(prompt.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto">
        <Button asChild variant="ghost" size="sm">
          <Link to={withFrom(`/p/${prompt.id}`, from)}>查看</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={withFrom(`/p/${prompt.id}/edit`, from)}>编辑</Link>
        </Button>
        {prompt.submissions === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted hover:text-negative"
            onClick={() =>
              onDelete({
                intent: "deletePrompt",
                id: prompt.id,
                title: "删除这道题目？",
                description: `「${prompt.title}」从未收到过答案。删除后无法恢复。`,
                confirmLabel: "删除",
                destructive: true,
              })
            }
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            删除
          </Button>
        )}
      </div>
    </li>
  );
}

function PromptList({
  result,
  from,
  onDelete,
}: {
  result: Awaited<ReturnType<typeof listOwnPrompts>>;
  from: string;
  onDelete: (pending: PendingAction) => void;
}) {
  const [items, setItems] = useState(result.prompts);
  const [next, setNext] = useState(result.nextPage);
  const fetcher = useFetcher<Awaited<ReturnType<typeof listOwnPrompts>>>();

  useEffect(() => {
    setItems(result.prompts);
    setNext(result.nextPage);
  }, [result]);

  const more = fetcher.data;
  useEffect(() => {
    if (!more || !("prompts" in more)) return;
    setItems((current) => {
      const seen = new Set(current.map((p) => p.id));
      return [...current, ...more.prompts.filter((p) => !seen.has(p.id))];
    });
    setNext(more.nextPage);
  }, [more]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    fetcher.load(`/api/mine/prompts?page=${next}`);
  }, [next, fetcher]);

  return (
    <>
      <ul className="mt-5 divide-y divide-rule overflow-hidden rounded-card border border-border bg-surface">
        {items.map((prompt) => (
          <PromptRowItem key={prompt.id} prompt={prompt} from={from} onDelete={onDelete} />
        ))}
      </ul>
      <LoadMore
        hasMore={Boolean(next)}
        loading={fetcher.state !== "idle"}
        onLoad={loadMore}
        shown={items.length}
        total={result.total}
        noun="道题"
      />
    </>
  );
}

function AnswerRowItem({
  answer,
  origin,
  from,
  onAction,
}: {
  answer: AnswerRow;
  origin: string;
  from: string;
  onAction: (pending: PendingAction) => void;
}) {
  const hidden = answer.status === "hidden";
  const editable = !hidden;
  const title = `${answer.model.name} · ${answer.provider.name}`;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-raised/30 sm:flex-row sm:items-center">
      {hidden ? (
        <div className="block w-32 shrink-0 overflow-hidden rounded-control border border-border opacity-70 sm:w-40">
          <SubmissionPreview
            kind={answer.promptKind}
            submissionId={answer.id}
            origin={origin}
            title={title}
            excerpt={answer.excerpt}
          />
        </div>
      ) : (
        <Link
          to={withFrom(`/s/${answer.id}`, from)}
          className="block w-32 shrink-0 overflow-hidden rounded-control border border-border transition-colors hover:border-control sm:w-40"
          aria-label={title}
        >
          <SubmissionPreview
            kind={answer.promptKind}
            submissionId={answer.id}
            origin={origin}
            title={title}
            excerpt={answer.excerpt}
          />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={withFrom(`/s/${answer.id}`, from)}
            className="truncate text-[15px] font-semibold tracking-tight hover:text-accent-ink"
          >
            {title}
          </Link>
          {hidden && (
            <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[11px] text-muted">
              已撤回
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-muted">
          题目：
          <Link to={withFrom(`/p/${answer.promptId}`, from)} className="hover:text-ink">
            {answer.promptTitle}
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <StarScore starSum={answer.starSum} votes={answer.votes} />
          <span>·</span>
          <span>{formatRelative(answer.createdAt)}</span>
          {answer.updatedAt && answer.updatedAt > answer.createdAt && (
            <>
              <span>·</span>
              <span>已编辑</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto">
        {!hidden && (
          <Button asChild variant="ghost" size="sm">
            <Link to={withFrom(`/s/${answer.id}`, from)}>查看</Link>
          </Button>
        )}
        {editable && (
          <Button asChild variant="outline" size="sm">
            <Link to={withFrom(`/s/${answer.id}/edit`, from)}>编辑</Link>
          </Button>
        )}
        {hidden ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onAction({
                intent: "restoreAnswer",
                id: answer.id,
                title: "恢复这份答案？",
                description: "恢复后会重新出现在题目页，并计入评分统计。",
                confirmLabel: "恢复",
                destructive: false,
              })
            }
          >
            恢复
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted hover:text-negative"
            onClick={() =>
              onAction({
                intent: "withdrawAnswer",
                id: answer.id,
                title: "撤回这份答案？",
                description:
                  "撤回后会从题目页与统计中消失。文件与评分记录会保留，你可以随时在这里恢复。",
                confirmLabel: "撤回",
                destructive: true,
              })
            }
          >
            撤回
          </Button>
        )}
      </div>
    </li>
  );
}

function AnswerList({
  result,
  origin,
  from,
  onAction,
}: {
  result: Awaited<ReturnType<typeof listOwnSubmissions>>;
  origin: string;
  from: string;
  onAction: (pending: PendingAction) => void;
}) {
  const [items, setItems] = useState(result.submissions);
  const [next, setNext] = useState(result.nextPage);
  const fetcher = useFetcher<Awaited<ReturnType<typeof listOwnSubmissions>>>();

  useEffect(() => {
    setItems(result.submissions);
    setNext(result.nextPage);
  }, [result]);

  const more = fetcher.data;
  useEffect(() => {
    if (!more || !("submissions" in more)) return;
    setItems((current) => {
      const seen = new Set(current.map((s) => s.id));
      return [...current, ...more.submissions.filter((s) => !seen.has(s.id))];
    });
    setNext(more.nextPage);
  }, [more]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    fetcher.load(`/api/mine/submissions?page=${next}`);
  }, [next, fetcher]);

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
        <p className="text-sm text-muted">还没有交过答案。</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">去题目列表看看</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-5 divide-y divide-rule overflow-hidden rounded-card border border-border bg-surface">
        {items.map((answer) => (
          <AnswerRowItem
            key={answer.id}
            answer={answer}
            origin={origin}
            from={from}
            onAction={onAction}
          />
        ))}
      </ul>
      <LoadMore
        hasMore={Boolean(next)}
        loading={fetcher.state !== "idle"}
        onLoad={loadMore}
        shown={items.length}
        total={result.total}
        noun="份答案"
      />
    </>
  );
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const { counts, tab, result, canCreate, usercontentOrigin } = loaderData;
  const actionFetcher = useFetcher<ActionResult>();
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    const result = actionFetcher.data;
    if (!result) return;
    if ("error" in result) toast.error(result.error);
    else toast.success(result.message);
    setPending(null);
  }, [actionFetcher.data]);

  const busy = actionFetcher.state !== "idle";

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader
        title="我的"
        subtitle={
          <>
            <span className="num">{counts.prompts}</span> 道题 ·{" "}
            <span className="num">{counts.submissions}</span> 份答案
          </>
        }
        actions={
          canCreate ? (
            <Button asChild variant="primary" className="gap-1.5">
              <Link to="/prompts/new">
                <PenLine className="size-4" strokeWidth={1.75} />
                出题
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mt-3 flex items-end gap-5 border-b border-border">
        <TabLink
          to="/me"
          active={tab === "prompts"}
          label="题目"
          count={counts.prompts}
        />
        <TabLink
          to="/me?tab=answers"
          active={tab === "answers"}
          label="答案"
          count={counts.submissions}
        />
      </div>

      {tab === "prompts" ? (
        result.prompts.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
            <p className="text-sm text-muted">还没有出过题。</p>
            {!canCreate && (
              <p className="mt-2 text-xs text-muted">出题需要信任等级 2 及以上。</p>
            )}
          </div>
        ) : (
          <PromptList
            result={result}
            from="/me?tab=prompts"
            onDelete={setPending}
          />
        )
      ) : result.submissions.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
          <p className="text-sm text-muted">还没有交过答案。</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">去题目列表看看</Link>
          </Button>
        </div>
      ) : (
        <AnswerList
          result={result}
          origin={usercontentOrigin}
          from="/me?tab=answers"
          onAction={setPending}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.confirmLabel ?? "确认"}
        destructive={pending?.destructive}
        busy={busy}
        onConfirm={() => {
          if (!pending) return;
          actionFetcher.submit(
            { intent: pending.intent, id: pending.id },
            { method: "post" },
          );
        }}
      />
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex items-center gap-2 px-2 py-16 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      加载中…
    </div>
  );
}
