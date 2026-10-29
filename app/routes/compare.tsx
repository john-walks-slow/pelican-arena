import { ArrowLeft } from "lucide-react";
import { data, Link } from "react-router";
import type { Route } from "./+types/compare";
import { LiveFrame } from "~/components/page-preview";
import { StarScore } from "~/components/stars";
import { ModTags } from "~/components/submission-tags";
import { origins } from "~/lib/origins.server";
import { getPrompt, getSubmission } from "~/lib/queries.server";
import { usercontentUrl } from "~/lib/sandbox";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `对比 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
];

export async function loader({ request }: Route.LoaderArgs) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 4);
  const submissions = (await Promise.all(ids.map(getSubmission))).filter(
    (s): s is NonNullable<typeof s> => s !== null && s.status === "active",
  );
  if (submissions.length < 2) throw data("至少选择两份答案", { status: 400 });
  const prompt = await getPrompt(submissions[0].promptId);
  if (!prompt) throw data("Not Found", { status: 404 });
  return {
    prompt: { id: prompt.id, title: prompt.title },
    submissions: submissions.filter((s) => s.promptId === prompt.id),
    usercontentOrigin: origins().usercontent,
  };
}

const COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 2xl:grid-cols-4",
};

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { prompt, submissions, usercontentOrigin } = loaderData;
  return (
    <div>
      <Link to={`/p/${prompt.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        {prompt.title}
      </Link>
      <h1 className="mt-1 text-title font-bold tracking-tight">并排对比</h1>

      <div className={`mt-6 grid gap-4 ${COLS[submissions.length]}`}>
        {submissions.map((s) => (
          <section key={s.id} className="panel min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <Link to={`/s/${s.id}`} className="min-w-0 hover:text-accent-ink">
                <h2 className="truncate text-[15px] font-semibold">{s.model.name}</h2>
                <p className="truncate text-sm text-muted">
                  {s.provider.name}
                  {s.harness && ` · ${s.harness.name}`}
                </p>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StarScore starSum={s.starSum} votes={s.votes} />
                <div className="flex gap-1">
                  <ModTags mods={s.mods} />
                </div>
              </div>
            </div>
            <LiveFrame
              src={usercontentUrl(usercontentOrigin, s.id)}
              title={s.model.name}
              className="h-[70vh] w-full"
            />
          </section>
        ))}
      </div>
    </div>
  );
}
