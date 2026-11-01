import { ArrowUpRight, Shapes, Trophy } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/leaderboard";
import { PageHeader } from "~/components/page-header";
import { ScoreMethod } from "~/components/score-method";
import { Segmented } from "~/components/ui/segmented";
import { CompactSelect } from "~/components/ui/compact-select";
import { KIND_META, PROMPT_KINDS, isPromptKind, type PromptKind } from "~/lib/kinds";
import {
  buildLeaderboard,
  DEFAULT_DIMENSION,
  isDimension,
  MIN_VOTES,
  type Dimension,
  type LeaderboardEntry,
} from "~/lib/leaderboard";
import { answerCountsByKind, leaderboardData } from "~/lib/queries.server";
import { cachedClientLoader } from "~/lib/route-cache";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => [
  { title: "排名 · Pelican Arena" },
  {
    name: "description",
    content: "按坛友打分排出的模型、提供方与客户端榜单，分数已按题目难度和打分习惯校准。",
  },
  { property: "og:title", content: "排名 · Pelican Arena" },
];

const DIMENSION_LABELS: Record<Dimension, string> = {
  model: "模型",
  provider: "提供方",
  harness: "客户端",
  "model-provider": "模型 × 提供方",
};

/** What the second column counts, per dimension. */
const UNIT_LABELS: Record<Dimension, string> = {
  model: "个模型",
  provider: "家提供方",
  harness: "个客户端",
  "model-provider": "种组合",
};

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const dimensionParam = params.get("by");
  const dimension: Dimension = isDimension(dimensionParam) ? dimensionParam : DEFAULT_DIMENSION;
  const kindParam = params.get("kind");
  const kind: PromptKind | null = isPromptKind(kindParam) ? kindParam : null;

  const [data, kindCounts] = await Promise.all([leaderboardData(kind), answerCountsByKind()]);
  const board = buildLeaderboard({ ...data, dimension });

  return {
    board,
    dimension,
    kind,
    kindCounts,
    answers: data.submissions.length,
  };
}

export function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  return cachedClientLoader(request, serverLoader);
}

const MEDALS = ["text-[#b4883b]", "text-[#8c929c]", "text-[#a06a43]"];

function Rank({ place }: { place: number | null }) {
  if (place === null) {
    return <span className="num text-xs text-control">—</span>;
  }
  if (place <= 3) {
    return (
      <span className="inline-flex items-center gap-1">
        <Trophy className={cn("size-3.5", MEDALS[place - 1])} strokeWidth={2} />
        <span className="num text-sm font-semibold text-ink">{place}</span>
      </span>
    );
  }
  return <span className="num text-sm text-muted">{place}</span>;
}

/** The calibrated score, with a track showing where it sits on the five-star scale. */
function ScoreBar({ score, ranked }: { score: number | null; ranked: boolean }) {
  if (score === null) {
    return <span className="num text-sm text-control">—</span>;
  }
  const fill = Math.max(0, Math.min(1, (score - 1) / 4));
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div
        aria-hidden
        className="hidden h-1 w-16 overflow-hidden rounded-full bg-accent-track/60 sm:block"
      >
        <div
          className={cn("h-full rounded-full", ranked ? "bg-accent" : "bg-control")}
          style={{ width: `${Math.max(fill * 100, 3)}%` }}
        />
      </div>
      <span
        className={cn(
          "num text-sm font-semibold tabular-nums",
          ranked ? "text-ink" : "text-muted",
        )}
      >
        {score.toFixed(2)}
      </span>
    </div>
  );
}

function Row({
  entry,
  place,
  index,
}: {
  entry: LeaderboardEntry;
  place: number | null;
  index: number;
}) {
  return (
    <tr
      style={{ "--stagger": `${Math.min(index, 12) * 18}ms` } as CSSProperties}
      className="reveal-card border-t border-rule first:border-t-0 hover:bg-raised/45"
    >
      <td className="w-12 py-2.5 pl-3 pr-1 align-middle sm:pl-4">
        <Rank place={place} />
      </td>

      <td className="min-w-0 py-2.5 pr-3 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{entry.name}</span>
          {entry.best && (
            <Link
              to={`/s/${entry.best.submissionId}`}
              prefetch="intent"
              title={`最佳答案：${entry.best.promptTitle}`}
              aria-label={`查看最佳答案：${entry.best.promptTitle}`}
              className="shrink-0 text-muted transition-colors hover:text-accent"
            >
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
        {entry.sublabel && (
          <div className="mt-0.5 truncate text-[11px] text-muted">{entry.sublabel}</div>
        )}
        {!entry.ranked && (
          <div className="mt-0.5 text-[11px] text-muted sm:hidden">
            样本不足 {MIN_VOTES} 票
          </div>
        )}
      </td>

      <td className="hidden w-24 py-2.5 pr-3 text-right align-middle md:table-cell">
        <span className="num text-xs text-muted">
          {entry.raw === null ? "—" : entry.raw.toFixed(2)}
        </span>
      </td>

      <td className="w-20 py-2.5 pr-3 text-right align-middle sm:w-24">
        <span className="num text-xs text-muted">
          {entry.answers}
          <span className="hidden sm:inline"> / {entry.prompts}</span>
        </span>
      </td>

      <td className="w-14 py-2.5 pr-3 text-right align-middle">
        <span className="num text-xs text-muted">{entry.votes}</span>
      </td>

      <td className="w-28 py-2.5 pr-3 pl-1 text-right align-middle sm:pr-4">
        <ScoreBar score={entry.score} ranked={entry.ranked} />
      </td>
    </tr>
  );
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const { board, dimension, kind, kindCounts, answers } = loaderData;
  const [, setParams] = useSearchParams();
  const [showUnranked, setShowUnranked] = useState(false);

  const update = (key: string, value: string | null) => {
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

  const ranked = board.entries.filter((e) => e.ranked);
  const unranked = board.entries.filter((e) => !e.ranked);
  const shown = showUnranked ? board.entries : ranked;

  const countFor = (value: PromptKind) => kindCounts.find((row) => row.kind === value)?.n ?? 0;

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="排名"
        subtitle={
          <>
            <span className="num">{board.rankedCount}</span> {UNIT_LABELS[dimension]}进榜 ·{" "}
            <span className="num">{answers}</span> 份答案 ·{" "}
            <span className="num">{board.votes}</span> 次打分
          </>
        }
      />

      <div className="reveal-tier-1 mt-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="排名维度"
          value={dimension}
          onChange={(value) => update("by", value === DEFAULT_DIMENSION ? null : value)}
          options={[
            { value: "model", label: "模型" },
            { value: "provider", label: "提供方" },
            { value: "harness", label: "客户端" },
            { value: "model-provider", label: "模型 × 提供方" },
          ]}
          className="h-8"
        />

        <CompactSelect
          label="作品类型"
          icon={<Shapes className="size-3.5" strokeWidth={1.75} />}
          value={kind ?? "all"}
          onChange={(value) => update("kind", value === "all" ? null : value)}
          options={[
            { value: "all", label: "全部类型" },
            ...PROMPT_KINDS.map((value) => ({
              value,
              label: `${KIND_META[value].label}（${countFor(value)}）`,
            })),
          ]}
        />
      </div>

      {board.entries.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-control px-6 py-14 text-center">
          <Trophy className="mx-auto size-5 text-control" strokeWidth={1.75} />
          <p className="mt-3 text-sm text-muted">
            {kind
              ? `还没有${KIND_META[kind].label}类答案。`
              : "还没有答案可以排名。"}
          </p>
        </div>
      ) : (
        <>
          <div className="reveal-tier-2 mt-4 overflow-hidden rounded-card border border-border bg-surface">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">
                {DIMENSION_LABELS[dimension]}排名，按校准后的平均星级排序
              </caption>
              <thead>
                <tr className="bg-raised/55 text-[11px] font-medium text-muted">
                  <th scope="col" className="w-12 py-2 pl-3 text-left font-medium sm:pl-4">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-3 text-left font-medium">
                    {DIMENSION_LABELS[dimension]}
                  </th>
                  <th
                    scope="col"
                    className="hidden w-24 py-2 pr-3 text-right font-medium md:table-cell"
                  >
                    原始均分
                  </th>
                  <th scope="col" className="w-20 py-2 pr-3 text-right font-medium sm:w-24">
                    答案<span className="hidden sm:inline"> / 题目</span>
                  </th>
                  <th scope="col" className="w-14 py-2 pr-3 text-right font-medium">
                    打分
                  </th>
                  <th
                    scope="col"
                    className="w-28 py-2 pr-3 pl-1 text-right font-medium sm:pr-4"
                  >
                    校准分
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, index) => (
                  <Row
                    key={entry.key}
                    entry={entry}
                    place={entry.ranked ? index + 1 : null}
                    index={index}
                  />
                ))}
              </tbody>
            </table>

            {unranked.length > 0 && (
              <div className="border-t border-rule bg-raised/30 px-3 py-2 text-center sm:px-4">
                <button
                  type="button"
                  onClick={() => setShowUnranked((v) => !v)}
                  className="text-xs text-muted transition-colors hover:text-ink"
                >
                  {showUnranked
                    ? "收起样本不足的条目"
                    : `另有 ${unranked.length} 项打分不足 ${MIN_VOTES} 票，未参与排名`}
                </button>
              </div>
            )}
          </div>

          <ScoreMethod baseline={board.baseline} className="mt-4" />
        </>
      )}
    </div>
  );
}
