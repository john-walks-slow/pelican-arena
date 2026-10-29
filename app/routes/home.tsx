import { ArrowUpDown, Code2, PenLine, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import type { Route } from "./+types/home";
import { Avatar } from "~/components/avatar";
import { LoadMore } from "~/components/load-more";
import { SubmissionPreview } from "~/components/submission-preview";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CompactSelect } from "~/components/ui/compact-select";
import { formatRelative } from "~/lib/format";
import { KIND_META, PROMPT_KINDS, isPromptKind, type PromptKind } from "~/lib/kinds";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import { listPrompts, siteStats, type PromptSort } from "~/lib/queries.server";
import { useOptionalUser } from "~/lib/use-user";

export const meta: Route.MetaFunction = () => [
  { title: "Pelican Arena" },
  {
    name: "description",
    content: "同一道提示词，不同模型、不同提供方各交一份作品，直接对比。",
  },
  { property: "og:title", content: "Pelican Arena" },
  {
    property: "og:description",
    content: "同一道提示词，不同模型、不同提供方各交一份作品，直接对比。",
  },
];

function readQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const kindParam = params.get("kind");
  const kind: PromptKind | null = isPromptKind(kindParam) ? kindParam : null;
  const sortParam = params.get("sort");
  const sort: PromptSort =
    sortParam === "answers" || sortParam === "hardest" ? sortParam : "new";
  return { q, kind, sort };
}

export async function loader({ request }: Route.LoaderArgs) {
  const query = readQuery(request);
  const [gallery, stats] = await Promise.all([listPrompts(query), siteStats()]);
  return {
    ...gallery,
    ...query,
    stats,
    usercontentOrigin: origins(request).usercontent,
  };
}

function SearchField({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onCommit(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onCommit]);

  return (
    <div className="relative min-w-[8.5rem] flex-1 sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
        strokeWidth={1.75}
      />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onCommit(text.trim());
        }}
        placeholder="搜索题目"
        aria-label="搜索题目"
        className="h-8 pr-8 pl-8"
      />
      {text && (
        <button
          type="button"
          aria-label="清除搜索"
          onClick={() => {
            setText("");
            onCommit("");
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

type PromptItem = Route.ComponentProps["loaderData"]["prompts"][number];
interface MorePrompts {
  prompts: PromptItem[];
  total: number;
  page: number;
  nextPage: number | null;
  q: string;
  kind: PromptKind | null;
  sort: PromptSort;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { prompts, nextPage, total, q, kind, sort, stats, usercontentOrigin } = loaderData;
  const [params, setParams] = useSearchParams();
  const user = useOptionalUser();
  const fetcher = useFetcher<MorePrompts>();

  const [items, setItems] = useState(prompts);
  const [next, setNext] = useState(nextPage);

  useEffect(() => {
    setItems(prompts);
    setNext(nextPage);
  }, [prompts, nextPage]);

  const more = fetcher.data;
  useEffect(() => {
    if (!more || more.q !== q || more.kind !== kind || more.sort !== sort) return;
    setItems((current) => {
      const seen = new Set(current.map((p) => p.id));
      return [...current, ...more.prompts.filter((p) => !seen.has(p.id))];
    });
    setNext(more.nextPage);
  }, [more, q, kind, sort]);

  const update = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value) next.delete(key);
          else next.set(key, value);
          next.delete("page");
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const commitQuery = useCallback((value: string) => update("q", value), [update]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (kind) query.set("kind", kind);
    if (sort !== "new") query.set("sort", sort);
    query.set("page", String(next));
    fetcher.load(`/api/prompts?${query}`);
  }, [next, fetcher, q, kind, sort]);

  const filtered = Boolean(q || kind || sort !== "new");
  const loading = fetcher.state !== "idle";

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title font-bold tracking-tight">题目</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="num">{stats.prompts}</span> 道题 ·{" "}
            <span className="num">{stats.submissions}</span> 份答案 ·{" "}
            <span className="num">{stats.ratings}</span> 次打分
          </p>
        </div>
        {can(user, "createPrompt") && (
          <Button asChild variant="primary" className="gap-1.5">
            <Link to="/prompts/new">
              <PenLine className="size-4" strokeWidth={1.75} />
              出题
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <SearchField value={q} onCommit={commitQuery} />

          <CompactSelect
            label="作品类型"
            value={kind ?? "all"}
            options={[
              { value: "all", label: "全部类型" },
              ...PROMPT_KINDS.map((value) => ({
                value,
                label: KIND_META[value].label,
              })),
            ]}
            onChange={(value) => update("kind", value === "all" ? null : value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted"
              onClick={() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })}
            >
              清除
            </Button>
          )}
          <CompactSelect
            label="排序"
            icon={<ArrowUpDown className="size-3.5" strokeWidth={1.75} />}
            value={sort}
            onChange={(value) => update("sort", value === "new" ? null : value)}
            options={[
              { value: "new", label: "最新" },
              { value: "answers", label: "最多答案" },
              { value: "hardest", label: "最困难" },
            ]}
          />
        </div>
      </div>

      {filtered && (
        <p className="mt-2.5 text-xs text-muted">
          共 <span className="num">{total}</span> 道题
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
          <Code2 className="mx-auto size-5 text-control" strokeWidth={1.75} />
          <p className="mt-3 text-sm text-muted">
            {filtered ? (
              "没有匹配的题目。"
            ) : (
              <>
                还没有题目。
                {can(user, "createPrompt") && (
                  <Link to="/prompts/new" className="ml-1 font-medium text-accent hover:underline">
                    出第一道题
                  </Link>
                )}
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/p/${p.id}`}
                  className="group block overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-control"
                >
                  {p.coverSubmissionId ? (
                    <SubmissionPreview
                      kind={p.kind}
                      submissionId={p.coverSubmissionId}
                      origin={usercontentOrigin}
                      title={p.title}
                      excerpt={p.coverExcerpt}
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center border-b border-rule bg-raised/50 px-6">
                      <p className="line-clamp-4 text-center text-xs leading-relaxed text-muted">
                        {p.body}
                      </p>
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="truncate text-[15px] font-semibold group-hover:text-accent-ink">
                      {p.title}
                    </h2>
                    <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
                      <span className="shrink-0">{KIND_META[p.kind].label}</span>
                      <span>·</span>
                      <Avatar
                        template={p.author.avatarTemplate}
                        username={p.author.username}
                        size={16}
                      />
                      <span className="truncate">{p.author.username}</span>
                      <span className="shrink-0">·</span>
                      <span className="shrink-0">{formatRelative(p.createdAt)}</span>
                      <span className="num ml-auto shrink-0">
                        {p.submissions === 0 ? "暂无答案" : `${p.submissions} 份答案`}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <LoadMore
            hasMore={Boolean(next)}
            loading={loading}
            onLoad={loadMore}
            shown={items.length}
            total={total}
            noun="道题"
          />
        </>
      )}
    </div>
  );
}
