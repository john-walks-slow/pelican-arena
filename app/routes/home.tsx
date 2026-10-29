import { PenLine } from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/home";
import { Avatar } from "~/components/avatar";
import { PagePreview } from "~/components/page-preview";
import { formatRelative } from "~/lib/format";
import { origins } from "~/lib/origins.server";
import { can } from "~/lib/permissions";
import { listPrompts, siteStats } from "~/lib/queries.server";
import { usercontentUrl } from "~/lib/sandbox";
import { useOptionalUser } from "~/lib/use-user";

export const meta: Route.MetaFunction = () => [
  { title: "Pelican Arena" },
  { name: "description", content: "同一道提示词，不同模型、不同渠道各交一份网页，直接对比。" },
  { property: "og:title", content: "Pelican Arena" },
  { property: "og:description", content: "同一道提示词，不同模型、不同渠道各交一份网页，直接对比。" },
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-bold tracking-tight">题目</h1>
          <p className="mt-1 text-[15px] text-muted">
            <span className="num">{stats.prompts}</span> 道题 ·{" "}
            <span className="num">{stats.submissions}</span> 份答案 ·{" "}
            <span className="num">{stats.ratings}</span> 次打分
          </p>
        </div>
        {can(user, "createPrompt") && (
          <Link to="/prompts/new" className="btn-primary">
            <PenLine className="size-4" strokeWidth={1.75} />
            出题
          </Link>
        )}
      </div>

      {prompts.length === 0 ? (
        <div className="panel mt-6 px-6 py-10 text-center text-muted">
          还没有题目。
          {can(user, "createPrompt") && (
            <Link to="/prompts/new" className="ml-1 font-medium text-accent hover:underline">
              出第一道题
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {prompts.map((p) => (
            <li key={p.id}>
              <Link
                to={`/p/${p.id}`}
                className="panel group block overflow-hidden transition-colors hover:border-control"
              >
                {p.coverSubmissionId ? (
                  <PagePreview
                    src={usercontentUrl(usercontentOrigin, p.coverSubmissionId)}
                    title={p.title}
                  />
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-raised px-6">
                    <p className="line-clamp-4 text-center text-sm text-muted">{p.body}</p>
                  </div>
                )}
                <div className="p-4">
                  <h2 className="truncate text-[15px] font-semibold group-hover:text-accent-ink">
                    {p.title}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <Avatar template={p.author.avatarTemplate} username={p.author.username} size={18} />
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
