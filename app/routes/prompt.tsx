import { Columns2, Upload } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, useSearchParams, useSubmit } from "react-router";
import type { Route } from "./+types/prompt";
import { Avatar } from "~/components/avatar";
import { CopyButton } from "~/components/copy-button";
import { PagePreview } from "~/components/page-preview";
import { StarScore } from "~/components/stars";
import { AttemptTag, ModTags } from "~/components/submission-tags";
import { formatRelative } from "~/lib/format";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import {
  getCatalog,
  getPrompt,
  listSubmissions,
  type SubmissionSort,
} from "~/lib/queries.server";
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

  const url = new URL(request.url);
  const q = url.searchParams;
  const sort: SubmissionSort = q.get("sort") === "new" ? "new" : "top";
  const filters = {
    model: q.get("model") || undefined,
    provider: q.get("provider") || undefined,
    harness: q.get("harness") || undefined,
    vanilla: q.get("vanilla") === "1",
    firstOnly: q.get("first") === "1",
  };
  const [submissions, catalog] = await Promise.all([
    listSubmissions(prompt.id, filters, sort),
    getCatalog(),
  ]);
  return { prompt, submissions, catalog, usercontentOrigin: origins().usercontent };
}

function FilterBar({ catalog }: { catalog: Route.ComponentProps["loaderData"]["catalog"] }) {
  const [params] = useSearchParams();
  const submit = useSubmit();
  const selects = [
    { name: "model", label: "全部模型", options: catalog.models },
    { name: "provider", label: "全部提供方", options: catalog.providers },
    { name: "harness", label: "全部客户端", options: catalog.harnesses },
  ];
  const active = selects.some((s) => params.get(s.name)) || params.get("vanilla") || params.get("first");

  return (
    <Form
      method="get"
      preventScrollReset
      onChange={(e) => submit(e.currentTarget, { preventScrollReset: true, replace: true })}
      className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap"
    >
      {selects.map((s) => (
        <select
          key={s.name}
          name={s.name}
          defaultValue={params.get(s.name) ?? ""}
          className="field sm:w-auto sm:max-w-44"
          aria-label={s.label}
        >
          <option value="">{s.label}</option>
          {s.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ))}
      <label className="flex h-8 items-center gap-1.5 px-1 text-sm text-ink">
        <input type="checkbox" name="vanilla" value="1" defaultChecked={params.get("vanilla") === "1"} className="accent-accent" />
        仅 vanilla
      </label>
      <label className="flex h-8 items-center gap-1.5 px-1 text-sm text-ink">
        <input type="checkbox" name="first" value="1" defaultChecked={params.get("first") === "1"} className="accent-accent" />
        仅一次出
      </label>
      <select
        name="sort"
        defaultValue={params.get("sort") ?? "top"}
        className="field sm:ml-auto sm:w-auto"
        aria-label="排序"
      >
        <option value="top">评分最高</option>
        <option value="new">最新</option>
      </select>
      {active && (
        <Link to="?" replace preventScrollReset className="btn-ghost">
          清除筛选
        </Link>
      )}
    </Form>
  );
}

export default function PromptPage({ loaderData }: Route.ComponentProps) {
  const { prompt, submissions, catalog, usercontentOrigin } = loaderData;
  const user = useOptionalUser();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_COMPARE ? [...cur, id] : cur,
    );

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title font-bold tracking-tight">{prompt.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Avatar template={prompt.author.avatarTemplate} username={prompt.author.username} size={20} />
            <span>{prompt.author.username}</span>
            <span>·</span>
            <span>{formatRelative(prompt.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <CopyButton text={prompt.body} label="复制提示词" />
          {can(user, "submit") ? (
            <Link to={`/p/${prompt.id}/submit`} className="btn-primary">
              <Upload className="size-4" strokeWidth={1.75} />
              交答案
            </Link>
          ) : !user ? (
            <a href={`/auth/login?returnTo=/p/${prompt.id}/submit`} className="btn-primary">
              <Upload className="size-4" strokeWidth={1.75} />
              交答案
            </a>
          ) : null}
        </div>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="sr-only">提示词</h2>
        <p className="prose-prompt max-h-80 overflow-y-auto">{prompt.body}</p>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-section font-semibold">
            答案 <span className="num font-normal text-muted">{submissions.length}</span>
          </h2>
        </div>
        <div className="mt-3">
          <FilterBar catalog={catalog} />
        </div>

        {submissions.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-control px-6 py-10 text-center text-muted">
            没有符合条件的答案。
          </div>
        ) : (
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {submissions.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <li key={s.id} className={`panel overflow-hidden ${isSelected ? "border-accent ring-2 ring-accent/20" : ""}`}>
                  <Link to={`/s/${s.id}`} className="block" aria-label={`${s.model.name} · ${s.provider.name}`}>
                    <PagePreview src={usercontentUrl(usercontentOrigin, s.id)} title={s.model.name} />
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/s/${s.id}`} className="min-w-0 hover:text-accent-ink">
                        <div className="truncate text-[15px] font-semibold">{s.model.name}</div>
                        <div className="truncate text-sm text-muted">
                          {s.provider.name}
                          {s.harness && ` · ${s.harness.name}`}
                        </div>
                      </Link>
                      <StarScore starSum={s.starSum} votes={s.votes} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <ModTags mods={s.mods} />
                      <AttemptTag attempt={s.attempt} count={s.attemptCount} />
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-ink">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(s.id)}
                          disabled={!isSelected && selected.length >= MAX_COMPARE}
                          className="accent-accent"
                        />
                        对比
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          {/* taste-skill-ignore: floating overlay */}
          <div className="flex items-center gap-3 rounded-full bg-primary py-1.5 pr-1.5 pl-4 text-sm text-white shadow-lg">
            <span className="num">已选 {selected.length} / {MAX_COMPARE}</span>
            <button type="button" className="text-white/70 hover:text-white" onClick={() => setSelected([])}>
              清空
            </button>
            <Link
              to={`/compare?ids=${selected.join(",")}`}
              className={`btn h-8 rounded-full bg-white text-ink hover:bg-white/90 ${selected.length < 2 ? "pointer-events-none opacity-50" : ""}`}
              aria-disabled={selected.length < 2}
            >
              <Columns2 className="size-4" strokeWidth={1.75} />
              并排对比
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
