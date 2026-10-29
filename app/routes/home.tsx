import { Code2, PenLine } from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { Avatar } from "~/components/avatar";
import { PagePreview } from "~/components/page-preview";
import { Button } from "~/components/ui/button";
import { formatRelative } from "~/lib/format";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import { listPrompts, siteStats } from "~/lib/queries.server";
import { usercontentUrl } from "~/lib/sandbox";
import { useOptionalUser } from "~/lib/use-user";

export const meta: Route.MetaFunction = () => [
  { title: "Pelican Arena" },
  {
    name: "description",
    content: "同一道提示词，不同模型、不同提供方各交一份网页，直接对比。",
  },
  { property: "og:title", content: "Pelican Arena" },
  {
    property: "og:description",
    content: "同一道提示词，不同模型、不同提供方各交一份网页，直接对比。",
  },
];

export async function loader() {
  const [prompts, stats] = await Promise.all([listPrompts(), siteStats()]);
  return { prompts, stats, usercontentOrigin: origins().usercontent };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { prompts, stats, usercontentOrigin } = loaderData;
  const user = useOptionalUser();

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

      {prompts.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
          <Code2 className="mx-auto size-5 text-control" strokeWidth={1.75} />
          <p className="mt-3 text-sm text-muted">
            还没有题目。
            {can(user, "createPrompt") && (
              <Link to="/prompts/new" className="ml-1 font-medium text-accent hover:underline">
                出第一道题
              </Link>
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {prompts.map((p) => (
            <li key={p.id}>
              <Link
                to={`/p/${p.id}`}
                className="group block overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-control"
              >
                {p.coverSubmissionId ? (
                  <PagePreview
                    src={usercontentUrl(usercontentOrigin, p.coverSubmissionId)}
                    title={p.title}
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
                    <Avatar
                      template={p.author.avatarTemplate}
                      username={p.author.username}
                      size={18}
                    />
                    <span className="truncate">{p.author.username}</span>
                    <span>·</span>
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
      )}
    </div>
  );
}
