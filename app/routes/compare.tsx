import { ArrowUpRight } from "lucide-react";
import { data, Link } from "react-router";
import type { Route } from "./+types/compare";
import { Markdown } from "~/components/markdown";
import { PageHeader } from "~/components/page-header";
import { LiveFrame } from "~/components/page-preview";
import { StarScore } from "~/components/stars";
import { ModTags } from "~/components/submission-tags";
import { origins } from "~/lib/origins.server";
import { getPrompt, getSubmission } from "~/lib/queries.server";
import { submissionUrl } from "~/lib/sandbox";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `并排对比 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
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
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    submissions: submissions.filter((s) => s.promptId === prompt.id),
    usercontentOrigin: origins(request).usercontent,
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
      <PageHeader
        back={{ to: `/p/${prompt.id}`, label: prompt.title }}
        title="并排对比"
      />

      <div className={`mt-2.5 grid gap-4 ${COLS[submissions.length]}`}>
        {submissions.map((s) => (
          <section
            key={s.id}
            className="flex flex-col overflow-hidden rounded-card border border-border bg-surface"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">{s.model.name}</h2>
                  <Link
                    to={`/s/${s.id}`}
                    className="text-muted hover:text-accent transition-colors shrink-0"
                    title="查看详情"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
                <p className="truncate text-[11px] text-muted mt-0.5">
                  {s.provider.name}
                  {s.harness && ` · ${s.harness.name}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StarScore starSum={s.starSum} votes={s.votes} />
                <div className="flex flex-wrap gap-1 justify-end">
                  <ModTags mods={s.mods} />
                </div>
              </div>
            </div>
            {prompt.kind === "web" ? (
              <LiveFrame
                src={submissionUrl(usercontentOrigin, s.id, prompt.kind)}
                title={s.model.name}
                className="h-[68vh] w-full bg-white"
              />
            ) : prompt.kind === "svg" ? (
              <div className="flex h-[68vh] items-center justify-center bg-white p-6">
                <img
                  src={submissionUrl(usercontentOrigin, s.id, prompt.kind)}
                  alt={s.model.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="h-[68vh] overflow-y-auto scroll-thin bg-white px-6 py-6">
                <Markdown>{s.content ?? ""}</Markdown>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
