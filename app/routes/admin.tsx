import { Check, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { data, Form, Link, useFetcher, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/admin";
import { PromptReviewCard, type PendingPrompt } from "~/components/admin/prompt-review-card";
import { PageHeader } from "~/components/page-header";
import { ReportCard, type ReportGroupData } from "~/components/admin/report-card";
import { LoadMore } from "~/components/load-more";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toaster";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "~/lib/api-tokens.server";
import { formatRelative } from "~/lib/format";
import { requireAdmin } from "~/lib/guards.server";
import {
  isPromptAction,
  isSubmissionAction,
  isSubmissionServable,
  MODERATION_ACTION_LABELS,
  MODERATION_NOTE_LIMIT,
} from "~/lib/moderation";
import {
  applyPromptAction,
  applySubmissionAction,
  listModerationLog,
  listPendingPrompts,
  listReportGroups,
  ModerationConflict,
  ModerationValidation,
  moderationCounts,
} from "~/lib/moderation.server";
import { origins } from "~/lib/origins.server";
import { createPreviewGrant } from "~/lib/preview-grant.server";

const TABS = ["prompts", "reports", "log", "api"] as const;
type Tab = (typeof TABS)[number];

export function meta() {
  return [{ title: "审核 · Pelican Arena" }, { name: "robots", content: "noindex" }];
}

const ACTION_MESSAGES: Record<string, string> = {
  prompt_approve: "题目已通过",
  prompt_reject: "题目已驳回",
  prompt_remove: "题目已下架",
  prompt_restore: "题目已恢复",
  submission_keep: "已保留答案",
  submission_remove: "答案已下架",
  submission_restore: "答案已恢复",
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  const counts = await moderationCounts();
  const tabParam = url.searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : counts.pending > 0 ? "prompts" : "reports";

  if (tab === "prompts") {
    return { tab, counts, page, pending: await listPendingPrompts(page), tokens: null, log: null, reports: null };
  }
  if (tab === "reports") {
    const groups = await listReportGroups(page);
    const withGrants: ReportGroupData[] = await Promise.all(
      groups.groups.map(async (group) =>
        group.targetType === "prompt"
          ? group
          : {
              ...group,
              grant: isSubmissionServable(group.submission.status, group.submission.promptStatus)
                ? null
                : await createPreviewGrant(group.submission.id),
            },
      ),
    );
    return {
      tab,
      counts,
      page,
      reports: { ...groups, groups: withGrants },
      pending: null,
      tokens: null,
      log: null,
      usercontentOrigin: origins(request).usercontent,
    };
  }
  if (tab === "log") {
    return { tab, counts, page, log: await listModerationLog(page), pending: null, tokens: null, reports: null };
  }
  return { tab, counts, page, tokens: await listApiTokens(), pending: null, log: null, reports: null };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const actor = { kind: "user" as const, user: admin };
  const note = String(form.get("note") ?? "").slice(0, MODERATION_NOTE_LIMIT) || null;

  try {
    if (intent === "prompt" || intent === "submission") {
      const id = String(form.get("id") ?? "");
      const action = String(form.get("action") ?? "");
      if (!id) return data({ error: "缺少 id" }, { status: 400 });
      if (intent === "prompt") {
        if (!isPromptAction(action)) return data({ error: "不支持的操作" }, { status: 400 });
        const result = await applyPromptAction(actor, id, action, note);
        return { ok: true as const, message: ACTION_MESSAGES[`prompt_${action}`] ?? "已处理", status: result.status };
      }
      if (!isSubmissionAction(action)) return data({ error: "不支持的操作" }, { status: 400 });
      const result = await applySubmissionAction(actor, id, action, note);
      return { ok: true as const, message: ACTION_MESSAGES[`submission_${action}`] ?? "已处理", status: result.status };
    }

    if (intent === "createToken") {
      const name = String(form.get("name") ?? "").trim().slice(0, 40);
      if (!name) return data({ error: "请填写名称" }, { status: 400 });
      const token = await createApiToken(admin.id, name);
      return { ok: true as const, secret: token.secret, message: "Token 已创建" };
    }

    if (intent === "revokeToken") {
      await revokeApiToken(String(form.get("id") ?? ""));
      return { ok: true as const, message: "Token 已吊销" };
    }
  } catch (error) {
    if (error instanceof ModerationValidation) return data({ error: error.message }, { status: 400 });
    if (error instanceof ModerationConflict) return data({ error: error.message }, { status: 409 });
    throw error;
  }

  return data({ error: "未知操作" }, { status: 400 });
}

const TITLES: Record<Tab, string> = {
  prompts: "待审题目",
  reports: "举报",
  log: "记录",
  api: "接口",
};

function Tabs({ current, counts }: { current: Tab; counts: { pending: number; reports: number } }) {
  const [, setParams] = useSearchParams();
  const badge: Record<Tab, number | null> = {
    prompts: counts.pending,
    reports: counts.reports,
    log: null,
    api: null,
  };
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() =>
            setParams({ tab }, { replace: true, preventScrollReset: true })
          }
          className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors ${
            tab === current
              ? "border-accent font-medium text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {TITLES[tab]}
          {badge[tab] ? <span className="num text-xs text-muted">{badge[tab]}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- prompts ---------- */

type PendingData = Awaited<ReturnType<typeof listPendingPrompts>>;

function PromptQueue({ initial }: { initial: PendingData }) {
  const fetcher = useFetcher<PendingData>();
  const [items, setItems] = useState<PendingPrompt[]>(initial.prompts);
  const [next, setNext] = useState(initial.nextPage);

  useEffect(() => {
    setItems(initial.prompts);
    setNext(initial.nextPage);
  }, [initial]);

  useEffect(() => {
    if (!fetcher.data || fetcher.data.page !== next) return;
    setItems((current) => [...current, ...fetcher.data!.prompts]);
    setNext(fetcher.data.nextPage);
  }, [fetcher.data, next]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    fetcher.load(`/api/admin/prompts?page=${next}`);
  }, [next, fetcher]);

  if (items.length === 0) {
    return <EmptyState text="没有待审的题目。" />;
  }

  return (
    <>
      <ul className="mt-4 space-y-3">
        {items.map((prompt) => (
          <li key={prompt.id}>
            <PromptReviewCard prompt={prompt} />
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={Boolean(next)}
        loading={fetcher.state !== "idle"}
        onLoad={loadMore}
        shown={items.length}
        total={initial.total}
        noun="道题目"
      />
    </>
  );
}

/* ---------- reports ---------- */

type ReportData = Awaited<ReturnType<typeof listReportGroups>>;

function ReportQueue({
  initial,
  usercontentOrigin,
}: {
  initial: ReportData;
  usercontentOrigin: string;
}) {
  const fetcher = useFetcher<ReportData>();
  const [items, setItems] = useState<ReportGroupData[]>(initial.groups as ReportGroupData[]);
  const [next, setNext] = useState(initial.nextPage);

  useEffect(() => {
    setItems(initial.groups as ReportGroupData[]);
    setNext(initial.nextPage);
  }, [initial]);

  useEffect(() => {
    if (!fetcher.data || fetcher.data.page !== next) return;
    setItems((current) => [...current, ...(fetcher.data!.groups as ReportGroupData[])]);
    setNext(fetcher.data.nextPage);
  }, [fetcher.data, next]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    fetcher.load(`/api/admin/reports?page=${next}`);
  }, [next, fetcher]);

  if (items.length === 0) {
    return <EmptyState text="没有待处理的举报。" />;
  }

  return (
    <>
      <ul className="mt-4 space-y-3">
        {items.map((group) => (
          <li key={`${group.targetType}:${group.targetType === "prompt" ? group.prompt.id : group.submission.id}`}>
            <ReportCard group={group} usercontentOrigin={usercontentOrigin} />
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={Boolean(next)}
        loading={fetcher.state !== "idle"}
        onLoad={loadMore}
        shown={items.length}
        total={initial.total}
        noun="项内容"
      />
    </>
  );
}

/* ---------- log ---------- */

type LogData = Awaited<ReturnType<typeof listModerationLog>>;

function LogList({ initial }: { initial: LogData }) {
  const fetcher = useFetcher<LogData>();
  const [items, setItems] = useState(initial.entries);
  const [next, setNext] = useState(initial.nextPage);

  useEffect(() => {
    setItems(initial.entries);
    setNext(initial.nextPage);
  }, [initial]);

  useEffect(() => {
    if (!fetcher.data || fetcher.data.page !== next) return;
    setItems((current) => [...current, ...fetcher.data!.entries]);
    setNext(fetcher.data.nextPage);
  }, [fetcher.data, next]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    fetcher.load(`/api/admin/log?page=${next}`);
  }, [next, fetcher]);

  if (items.length === 0) return <EmptyState text="还没有管理动作。" />;

  return (
    <>
      <ul className="mt-4 divide-y divide-rule rounded-card border border-border bg-surface">
        {items.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 text-[13px]">
            <span className="w-20 shrink-0 text-xs text-muted">{formatRelative(entry.createdAt)}</span>
            <span className="font-medium">{entry.actor ?? entry.token ?? "系统"}</span>
            <span className="text-muted">{MODERATION_ACTION_LABELS[entry.action]}</span>
            <Link
              to={entry.targetType === "prompt" ? `/p/${entry.targetId}` : `/s/${entry.targetId}`}
              className="min-w-0 truncate hover:text-accent-ink"
            >
              {entry.promptTitle ??
                (entry.submissionModel
                  ? `${entry.submissionModel} · ${entry.submissionPrompt ?? ""}`
                  : entry.targetId)}
            </Link>
            {entry.note && <span className="w-full text-xs text-muted">{entry.note}</span>}
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={Boolean(next)}
        loading={fetcher.state !== "idle"}
        onLoad={loadMore}
        shown={items.length}
        total={initial.total}
        noun="条记录"
      />
    </>
  );
}

/* ---------- api ---------- */

type TokenRow = Awaited<ReturnType<typeof listApiTokens>>[number];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-control bg-raised px-2.5 py-1.5 font-mono text-xs">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("已复制");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
        {copied ? "已复制" : "复制"}
      </Button>
    </div>
  );
}

function ApiPanel({ tokens }: { tokens: TokenRow[] }) {
  const fetcher = useFetcher<{ ok: true; secret?: string; message: string } | { error: string }>();
  const navigation = useNavigation();
  const busy = fetcher.state !== "idle" || navigation.state !== "idle";

  useEffect(() => {
    const result = fetcher.data;
    if (!result) return;
    if ("ok" in result) toast.success(result.message);
    else toast.error(result.error);
  }, [fetcher.data]);

  const revealed = fetcher.data && "secret" in fetcher.data ? fetcher.data.secret : undefined;

  return (
    <div className="mt-4 space-y-5">
      <section className="rounded-card border border-border bg-surface px-4 py-3.5 text-[13px] leading-relaxed">
        <p className="text-muted">
          供自动审核使用。请求带{" "}
          <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>，每个动作都会记入
          「记录」。完整说明见仓库{" "}
          <code className="font-mono text-xs">docs/references/261029-moderation-api.md</code>。
        </p>
        <dl className="mt-3 grid gap-1.5 font-mono text-xs">
          {[
            ["GET", "/api/v1", "词表与阈值"],
            ["GET", "/api/v1/prompts", "待审题目"],
            ["GET", "/api/v1/prompts/:id", "题目全文"],
            ["POST", "/api/v1/prompts/:id/actions", "通过 / 驳回 / 下架 / 恢复"],
            ["GET", "/api/v1/reports", "待处理举报"],
            ["GET", "/api/v1/submissions/:id", "答案、举报与预览地址"],
            ["POST", "/api/v1/submissions/:id/actions", "保留 / 下架 / 恢复"],
            ["GET", "/api/v1/log", "审核记录"],
            ["GET", "/api/v1/stats", "队列与站点计数"],
          ].map(([method, path, note]) => (
            <div key={path} className="flex gap-2">
              <dt className="w-10 shrink-0 text-muted">{method}</dt>
              <dd className="min-w-0 flex-1 truncate">{path}</dd>
              <dd className="shrink-0 font-sans text-muted">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-card border border-border bg-surface px-4 py-3.5">
        <h2 className="text-sm font-semibold">新建 Token</h2>
        <fetcher.Form method="post" className="mt-2 flex items-center gap-2">
          <input type="hidden" name="intent" value="createToken" />
          <Input name="name" placeholder="名称，例如 自动审核" maxLength={40} className="h-8 max-w-xs" />
          <Button type="submit" size="sm" disabled={busy}>
            生成
          </Button>
        </fetcher.Form>
        {revealed && (
          <div className="mt-3 space-y-1.5 rounded-control border border-pill-warning-ink/15 bg-pill-warning px-3 py-2.5">
            <p className="text-xs text-pill-warning-ink">
              只显示这一次，关闭页面后无法再查看。
            </p>
            <CopyField value={revealed} />
          </div>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface">
        <h2 className="px-4 pt-3.5 text-sm font-semibold">活跃 Token</h2>
        {tokens.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted">还没有创建过 Token。</p>
        ) : (
          <ul className="mt-1 divide-y divide-rule">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="font-medium">{token.name}</span>
                <span className="text-xs text-muted">
                  {token.createdBy} 创建 · 最近使用 {token.lastUsedAt ? formatRelative(token.lastUsedAt) : "从未"}
                </span>
                <fetcher.Form method="post" className="ml-auto">
                  <input type="hidden" name="intent" value="revokeToken" />
                  <input type="hidden" name="id" value={token.id} />
                  <Button type="submit" variant="ghost" size="sm" disabled={busy} className="text-muted hover:text-negative">
                    吊销
                  </Button>
                </fetcher.Form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------- page ---------- */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-card border border-dashed border-control px-6 py-16 text-center">
      <ShieldCheck className="mx-auto size-5 text-muted" strokeWidth={1.5} />
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

export default function AdminPage({ loaderData }: Route.ComponentProps) {
  const { tab, counts } = loaderData;

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title="审核"
        subtitle={
          <>
            待审 <span className="num">{counts.pending}</span> · 举报{" "}
            <span className="num">{counts.reports}</span>
          </>
        }
        actions={
          <Form method="get" action="/admin">
            <input type="hidden" name="tab" value={tab} />
            <Button type="submit" variant="outline" size="sm" className="gap-1">
              <RefreshCw className="size-3.5" strokeWidth={1.75} />
              刷新
            </Button>
          </Form>
        }
      />

      <div className="mt-3">
        <Tabs current={tab} counts={counts} />
      </div>

      {tab === "prompts" && loaderData.pending && <PromptQueue initial={loaderData.pending} />}
      {tab === "reports" && loaderData.reports && (
        <ReportQueue
          initial={loaderData.reports}
          usercontentOrigin={loaderData.usercontentOrigin ?? ""}
        />
      )}
      {tab === "log" && loaderData.log && <LogList initial={loaderData.log} />}
      {tab === "api" && loaderData.tokens && <ApiPanel tokens={loaderData.tokens} />}
    </div>
  );
}

