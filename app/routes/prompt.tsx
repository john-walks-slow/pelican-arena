import { ArrowLeft, Check, Columns2, Copy, Upload, X } from "lucide-react";
import { useState } from "react";
import { data, Link, useSearchParams } from "react-router";
import type { Route } from "./+types/prompt";
import { Avatar } from "~/components/avatar";
import { PagePreview } from "~/components/page-preview";
import { StarScore } from "~/components/stars";
import { ModTags } from "~/components/submission-tags";
import { Button } from "~/components/ui/button";
import { FilterSelect } from "~/components/ui/filter-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { formatRelative } from "~/lib/format";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import { getCatalog, getPrompt, listSubmissions, type SubmissionSort } from "~/lib/queries.server";
import { usercontentUrl } from "~/lib/sandbox";
import { useOptionalUser } from "~/lib/use-user";

const MAX_COMPARE = 4;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "找不到题目 · Pelican Arena" }];
  const { prompt, submissions } = loaderData;
  const description = `${submissions.length} 份答案。${prompt.body.slice(0, 120)}`;
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
    vanilla: q.get("vanilla") === "1",
  };
  const [submissions, catalog] = await Promise.all([
    listSubmissions(prompt.id, filters, sort),
    getCatalog(),
  ]);
  return { prompt, submissions, catalog, usercontentOrigin: origins().usercontent };
}

function FilterBar({ catalog }: { catalog: Route.ComponentProps["loaderData"]["catalog"] }) {
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") ?? "top";
  const vanilla = params.get("vanilla") === "1";

  const set = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const active = ["model", "provider", "harness", "mod"].some((k) => params.get(k)) || vanilla;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterSelect
        label="模型"
        value={params.get("model") ?? ""}
        options={catalog.models.map((m) => ({ value: m.id, label: m.name }))}
        onChange={(v) => set("model", v)}
      />
      <FilterSelect
        label="提供方"
        value={params.get("provider") ?? ""}
        options={catalog.providers.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(v) => set("provider", v)}
      />
      <FilterSelect
        label="客户端"
        value={params.get("harness") ?? ""}
        options={catalog.harnesses.map((h) => ({ value: h.id, label: h.name }))}
        onChange={(v) => set("harness", v)}
      />
      <FilterSelect
        label="增强"
        value={params.get("mod") ?? ""}
        options={catalog.mods.map((m) => ({ value: m.id, label: m.name }))}
        onChange={(v) => set("mod", v)}
      />
      <button
        type="button"
        onClick={() => set("vanilla", vanilla ? null : "1")}
        aria-pressed={vanilla}
        className={`inline-flex h-8 items-center rounded-control border px-2.5 text-xs transition-colors ${
          vanilla
            ? "border-ink/25 bg-raised font-medium text-ink"
            : "border-control bg-surface text-muted hover:bg-raised hover:text-ink"
        }`}
      >
        仅 vanilla
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted"
            onClick={() => setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })}
          >
            清除
          </Button>
        )}
        <Select value={sort} onValueChange={(v) => set("sort", v === "top" ? null : v)}>
          <SelectTrigger className="h-8 w-auto gap-1.5 px-2.5 text-xs text-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="top">评分最高</SelectItem>
            <SelectItem value="new">最新</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function PromptPage({ loaderData }: Route.ComponentProps) {
  const { prompt, submissions, catalog, usercontentOrigin } = loaderData;
  const user = useOptionalUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_COMPARE ? [...cur, id] : cur,
    );

  const copy = async () => {
    await navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-[1240px]">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        题目
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title font-bold tracking-tight">{prompt.title}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <Avatar template={prompt.author.avatarTemplate} username={prompt.author.username} size={18} />
            <span>{prompt.author.username}</span>
            <span>·</span>
            <span>{formatRelative(prompt.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" onClick={copy} className="gap-1.5">
            {copied ? (
              <Check className="size-4 text-positive" strokeWidth={2} />
            ) : (
              <Copy className="size-4 text-muted" strokeWidth={1.75} />
            )}
            {copied ? "已复制" : "复制提示词"}
          </Button>
          <Button asChild variant="primary" className="gap-1.5">
            <Link to={user ? `/p/${prompt.id}/submit` : `/auth/login?returnTo=/p/${prompt.id}/submit`}>
              <Upload className="size-4" strokeWidth={1.75} />
              交答案
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-5 rounded-card border border-border bg-surface px-4 py-3.5">
        <p className="prose-prompt max-h-64 overflow-y-auto scroll-thin text-[15px] leading-6">
          {prompt.body}
        </p>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <h2 className="text-section font-semibold">答案</h2>
          <span className="num text-sm text-muted">{submissions.length}</span>
        </div>

        <div className="mt-3">
          <FilterBar catalog={catalog} />
        </div>

        {submissions.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-muted">
            没有符合条件的答案。
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {submissions.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <li
                  key={s.id}
                  className={`overflow-hidden rounded-card border bg-surface transition-colors ${
                    isSelected ? "border-accent" : "border-border hover:border-control"
                  }`}
                >
                  <Link to={`/s/${s.id}`} aria-label={`${s.model.name} · ${s.provider.name}`}>
                    <PagePreview src={usercontentUrl(usercontentOrigin, s.id)} title={s.model.name} />
                  </Link>
                  <div className="px-3.5 pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/s/${s.id}`} className="min-w-0 hover:text-accent-ink">
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
    </div>
  );
}
