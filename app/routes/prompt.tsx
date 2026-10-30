import {
  AppWindow,
  ArrowUpDown,
  Check,
  Columns2,
  Copy,
  Cpu,
  Pencil,
  Puzzle,
  Server,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { data, Link, Outlet, useFetcher, useLocation, useSearchParams } from "react-router";
import type { Route } from "./+types/prompt";
import { Avatar } from "~/components/avatar";
import { LoadMore } from "~/components/load-more";
import { Markdown } from "~/components/markdown";
import { OutputRequirements } from "~/components/output-requirements";
import { PageHeader } from "~/components/page-header";
import { ShareDialog } from "~/components/share-dialog";
import { SubmissionPreview } from "~/components/submission-preview";
import { StarScore } from "~/components/stars";
import { ModTags } from "~/components/submission-tags";
import { Button } from "~/components/ui/button";
import { FilterSelect } from "~/components/ui/filter-select";
import { CompactSelect } from "~/components/ui/compact-select";
import { toast } from "~/components/ui/toaster";
import { formatRelative } from "~/lib/format";
import { backTarget, withFrom } from "~/lib/navigation";
import { KIND_META } from "~/lib/kinds";
import { origins } from "~/lib/origins.server";
import { promptWithRequirements } from "~/lib/output-requirements";
import { can } from "~/lib/permissions";
import {
  getPrompt,
  getPromptFacets,
  listSubmissions,
  type SubmissionSort,
} from "~/lib/queries.server";
import { useOptionalUser } from "~/lib/use-user";

const MAX_COMPARE = 4;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "找不到题目 · Pelican Arena" }];
  const { prompt, total } = loaderData;
  const description = `${total} 份答案。${prompt.body.slice(0, 120)}`;
  return [
    { title: `${prompt.title} · Pelican Arena` },
    { name: "description", content: description },
    { property: "og:title", content: prompt.title },
    { property: "og:description", content: description },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const q = new URL(request.url).searchParams;
  const sort: SubmissionSort = q.get("sort") === "new" ? "new" : "top";
  const filters = {
    model: q.get("model") || undefined,
    provider: q.get("provider") || undefined,
    harness: q.get("harness") || undefined,
    mod: q.get("mod") || undefined,
  };
  const [gallery, facets] = await Promise.all([
    listSubmissions(prompt.id, filters, sort),
    getPromptFacets(prompt.id),
  ]);
  const key = [sort, filters.model, filters.provider, filters.harness, filters.mod].join("|");
  return {
    prompt,
    ...gallery,
    facets,
    sort,
    key,
    usercontentOrigin: origins(request).usercontent,
    appOrigin: origins(request).app,
  };
}

type Facets = Route.ComponentProps["loaderData"]["facets"];
type SubmissionItem = Route.ComponentProps["loaderData"]["submissions"][number];
interface MoreSubmissions {
  submissions: SubmissionItem[];
  total: number;
  page: number;
  nextPage: number | null;
  key: string;
}

function FilterBar({ facets, total }: { facets: Facets; total: number }) {
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") ?? "top";

  const set = (key: string, value: string | null) => {
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
  };

  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <FilterSelect
          label="模型"
          icon={<Cpu className="size-3.5" strokeWidth={1.75} />}
          value={params.get("model") ?? ""}
          options={facets.models.map((m) => ({ value: m.id, label: m.name, count: m.count }))}
          onChange={(v) => set("model", v)}
          total={total}
        />
        <FilterSelect
          label="提供方"
          icon={<Server className="size-3.5" strokeWidth={1.75} />}
          value={params.get("provider") ?? ""}
          options={facets.providers.map((p) => ({ value: p.id, label: p.name, count: p.count }))}
          onChange={(v) => set("provider", v)}
          total={total}
        />
        <FilterSelect
          label="客户端"
          icon={<AppWindow className="size-3.5" strokeWidth={1.75} />}
          value={params.get("harness") ?? ""}
          options={facets.harnesses.map((h) => ({ value: h.id, label: h.name, count: h.count }))}
          onChange={(v) => set("harness", v)}
          total={total}
        />
        <FilterSelect
          label="增强"
          icon={<Puzzle className="size-3.5" strokeWidth={1.75} />}
          value={params.get("mod") ?? ""}
          options={facets.mods.map((m) => ({ value: m.id, label: m.name, count: m.count }))}
          onChange={(v) => set("mod", v)}
          total={total}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <CompactSelect
          label="排序"
          icon={<ArrowUpDown className="size-3.5" strokeWidth={1.75} />}
          value={sort}
          onChange={(v) => set("sort", v === "top" ? null : v)}
          options={[
            { value: "top", label: "评分最高" },
            { value: "new", label: "最新" },
          ]}
        />
      </div>
    </div>
  );
}

export default function PromptPage({ loaderData }: Route.ComponentProps) {
  const { prompt, submissions, total, nextPage, sort, key, facets, usercontentOrigin, appOrigin } = loaderData;
  const user = useOptionalUser();
  const [params] = useSearchParams();
  const { search } = useLocation();
  const from = params.get("from");
  const back = backTarget(from, { label: "题目", to: "/" });
  const here = `/p/${prompt.id}${search}`;
  const editHref = withFrom(`/p/${prompt.id}/edit`, here);
  const answerHref = (id: string) => withFrom(`/s/${id}`, here);
  const fetcher = useFetcher<MoreSubmissions>();

  const [items, setItems] = useState(submissions);
  const [next, setNext] = useState(nextPage);
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setItems(submissions);
    setNext(nextPage);
  }, [submissions, nextPage]);

  const more = fetcher.data;
  useEffect(() => {
    if (!more || more.key !== key || more.page !== next) return;
    setItems((current) => {
      const seen = new Set(current.map((s) => s.id));
      return [...current, ...more.submissions.filter((s) => !seen.has(s.id))];
    });
    setNext(more.nextPage);
  }, [more, key, next]);

  const loadMore = useCallback(() => {
    if (!next || fetcher.state !== "idle") return;
    const query = new URLSearchParams();
    for (const name of ["model", "provider", "harness", "mod"]) {
      const value = params.get(name);
      if (value) query.set(name, value);
    }
    if (sort === "new") query.set("sort", "new");
    query.set("page", String(next));
    fetcher.load(`/p/${prompt.id}/submissions?${query}`);
  }, [next, fetcher, params, prompt.id, sort]);

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_COMPARE ? [...cur, id] : cur,
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promptWithRequirements(prompt.body, prompt.kind));
      setCopied(true);
      toast.success("提示词已复制");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader
        back={{ to: back.to, label: back.label }}
        title={prompt.title}
        subtitle={
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{KIND_META[prompt.kind].label}</span>
            <span>·</span>
            <Avatar template={prompt.author.avatarTemplate} username={prompt.author.username} size={18} />
            <span>{prompt.author.username}</span>
            <span>·</span>
            <span>{formatRelative(prompt.createdAt)}</span>
            {prompt.updatedAt && (
              <>
                <span>·</span>
                <span>已编辑</span>
              </>
            )}
          </div>
        }
        actions={
          <>
            {user?.id === prompt.author.id && (
              <Button asChild variant="outline" className="gap-1.5 max-sm:px-2.5">
                <Link to={editHref} aria-label="编辑">
                  <Pencil className="size-4 text-muted" strokeWidth={1.75} />
                  <span className="hidden sm:inline">编辑</span>
                </Link>
              </Button>
            )}
            <ShareDialog path={`/p/${prompt.id}`} title={prompt.title} appOrigin={appOrigin} />
            <Button
              variant="outline"
              onClick={copy}
              className={`gap-1.5 ${copied ? "border-positive/40 text-positive" : ""}`}
              aria-live="polite"
            >
              {copied ? (
                <Check className="size-4" strokeWidth={2} />
              ) : (
                <Copy className="size-4 text-muted" strokeWidth={1.75} />
              )}
              {copied ? "已复制" : "复制提示词"}
            </Button>
            <Button asChild variant="primary" className="gap-1.5">
              <Link
                to={
                  user
                    ? { pathname: `/p/${prompt.id}/submit`, search }
                    : `/auth/login?returnTo=/p/${prompt.id}/submit`
                }
                preventScrollReset={Boolean(user)}
              >
                <Upload className="size-4" strokeWidth={1.75} />
                提交答案
              </Link>
            </Button>
          </>
        }
      />

      <section className="mt-2.5 rounded-card border border-border bg-surface px-4 py-3.5">
        <div className="max-h-64 overflow-y-auto scroll-thin">
          <Markdown>{prompt.body}</Markdown>
        </div>
        <OutputRequirements kind={prompt.kind} className="mt-3" />
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <h2 className="text-section font-semibold">答案</h2>
          <span className="num text-sm text-muted">{total}</span>
        </div>

        <div className="mt-3">
          <FilterBar facets={facets} total={facets.models.reduce((sum, f) => sum + f.count, 0)} />
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-muted">
            没有符合条件的答案。
          </div>
        ) : (
          <>
            <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => {
                const isSelected = selected.includes(s.id);
                return (
                  <li
                    key={s.id}
                    className={`overflow-hidden rounded-card border bg-surface transition-colors ${
                      isSelected ? "border-accent" : "border-border hover:border-control"
                    }`}
                  >
                    <Link
                      to={answerHref(s.id)}
                      aria-label={`${s.model.name} · ${s.provider.name}`}
                    >
                      <SubmissionPreview
                        kind={prompt.kind}
                        submissionId={s.id}
                        origin={usercontentOrigin}
                        title={s.model.name}
                        excerpt={s.excerpt}
                      />
                    </Link>
                    <div className="px-3.5 pt-3 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={answerHref(s.id)} className="min-w-0 hover:text-accent-ink">
                          <div className="truncate text-sm font-semibold">{s.model.name}</div>
                          <div className="truncate text-[13px] text-muted">
                            {s.provider.name}
                            {s.harness && ` · ${s.harness.name}`}
                          </div>
                        </Link>
                        <StarScore starSum={s.starSum} votes={s.votes} />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          <ModTags mods={s.mods} />
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(s.id)}
                          aria-pressed={isSelected}
                          disabled={!isSelected && selected.length >= MAX_COMPARE}
                          className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
                            isSelected ? "text-accent-ink" : "text-muted hover:text-ink"
                          }`}
                        >
                          <Columns2 className="size-3.5" strokeWidth={1.75} />
                          {isSelected ? "已选" : "对比"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <LoadMore
              hasMore={Boolean(next)}
              loading={fetcher.state !== "idle"}
              onLoad={loadMore}
              shown={items.length}
              total={total}
              noun="份答案"
            />
          </>
        )}
      </section>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-xs text-white/80">
            <span className="num">已选 {selected.length} / {MAX_COMPARE}</span>
            <button type="button" className="hover:text-white" onClick={() => setSelected([])}>
              <X className="size-3.5" strokeWidth={2} />
            </button>
            <Link
              to={`/compare?ids=${selected.join(",")}`}
              className={`inline-flex h-7 items-center rounded-full bg-white px-3 text-xs font-medium text-ink ${
                selected.length < 2 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              并排对比
            </Link>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
