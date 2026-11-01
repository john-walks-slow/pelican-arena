import { Shapes, Trophy } from "lucide-react";
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
  harness: "客户端",
};

/** What the second column counts, per dimension. */
const UNIT_LABELS: Record<Dimension, string> = {
  model: "个模型",
  harness: "个客户端",
};

type BoardSource = {
  data: Awaited<ReturnType<typeof leaderboardData>>;
  kindCounts: Awaited<ReturnType<typeof answerCountsByKind>>;
};

/**
 * The fit reads every active answer and rating, so it is served from a short
 * isolate-local cache instead of on every visit. Two minutes keeps D1 row reads
 * far inside the free daily budget, and a vote landing a minute late on a
 * month-long ranking is not something anyone notices.
 */
const CACHE_TTL = 120_000;
const cache = new Map<string, { at: number; value: BoardSource }>();

async function boardSource(kind: PromptKind | null): Promise<BoardSource> {
  const key = kind ?? "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
  const [data, kindCounts] = await Promise.all([leaderboardData(kind), answerCountsByKind()]);
  const value = { data, kindCounts };
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const dimensionParam = params.get("by");
  const dimension: Dimension = isDimension(dimensionParam) ? dimensionParam : DEFAULT_DIMENSION;
  const kindParam = params.get("kind");
  const kind: PromptKind | null = isPromptKind(kindParam) ? kindParam : null;

  const { data, kindCounts } = await boardSource(kind);
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

const MEDALS = ["text-accent", "text-accent/60", "text-accent/40"];

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

/** The calibrated score. Sample size sits next to it in its own column. */
function Score({ score, ranked }: { score: number | null; ranked: boolean }) {
  if (score === null) {
    return <span className="num text-sm text-control">—</span>;
  }
  return (
    <span
      className={cn(
        "num text-sm font-semibold tabular-nums",
        ranked ? "text-ink" : "text-muted",
      )}
    >
      {score.toFixed(2)}
    </span>
  );
}

/** Why there is no ranking yet, worded for the dimension being shown. */
function emptyReason(entries: number, kind: PromptKind | null, dimension: Dimension) {
  if (entries > 0) return `还没有条目攒够 ${MIN_VOTES} 票。`;
  if (dimension === "harness") return "还没有答案填写客户端。";
  if (kind) return `还没有${KIND_META[kind].label}类答案。`;
  return "还没有答案。";
}

function Row({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  return (
    <tr
      style={{ "--stagger": `${Math.min(index, 12) * 18}ms` } as CSSProperties}
      className="reveal-card border-t border-rule first:border-t-0 hover:bg-raised/45"
    >
      <td className="w-10 py-2.5 pl-3 pr-1 align-middle sm:w-12 sm:pl-4">
        <Rank place={entry.place} />
      </td>

      <th scope="row" className="min-w-0 py-2.5 pr-3 text-left align-middle font-normal">
        <span className="block truncate text-sm font-medium text-ink">{entry.name}</span>
        {entry.sublabel && (
          <div className="mt-0.5 truncate text-[11px] text-muted">{entry.sublabel}</div>
        )}
        <div className="num mt-0.5 text-[11px] text-muted sm:hidden">
          {entry.ranked ? `${entry.votes} 票 · ${entry.prompts} 题` : `样本不足 ${MIN_VOTES} 票`}
        </div>
      </th>

      <td className="hidden w-24 py-2.5 pr-3 text-right align-middle md:table-cell">
        <span className="num text-xs text-muted">
          {entry.raw === null ? "—" : entry.raw.toFixed(2)}
        </span>
      </td>

      <td className="hidden w-24 py-2.5 pr-3 text-right align-middle sm:table-cell">
        <span className="num text-xs text-muted">
          {entry.answers}
          <span className="hidden sm:inline"> / {entry.prompts}</span>
        </span>
      </td>

      <td className="hidden w-14 py-2.5 pr-3 text-right align-middle sm:table-cell">
        <span className="num text-xs text-muted">{entry.votes}</span>
      </td>

      <td className="w-16 py-2.5 pr-3 pl-1 text-right align-middle sm:w-28 sm:pr-4">
        <Score score={entry.score} ranked={entry.ranked} />
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
          answers > 0 ? (
            <>
              <span className="num">{board.rankedCount}</span> {UNIT_LABELS[dimension]}进榜 ·{" "}
              <span className="num">{answers}</span> 份答案 ·{" "}
              <span className="num">{board.votes}</span> 次打分
            </>
          ) : undefined
        }
      />

      <div className="reveal-tier-1 mt-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="排名维度"
          value={dimension}
          onChange={(value) => update("by", value === DEFAULT_DIMENSION ? null : value)}
          options={[
            { value: "model", label: "模型" },
            { value: "harness", label: "客户端" },
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

      {board.rankedCount === 0 && !showUnranked ? (
        <div className="reveal-tier-2 mt-4 rounded-card border border-dashed border-control px-6 py-12 text-center">
          <Trophy className="mx-auto size-5 text-control" strokeWidth={1.75} />
          <p className="mt-3 text-sm text-muted">{emptyReason(board.entries.length, kind, dimension)}</p>
          {board.entries.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              已有 <span className="num">{answers}</span> 份答案，还差几票就能排出先后。
            </p>
          )}
          {board.entries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnranked(true)}
              className="mt-4 rounded-control border border-control px-3 py-1.5 text-xs text-ink transition-colors hover:bg-raised"
            >
              先看看这些条目
            </button>
          )}
          <p className="mt-4 text-xs text-muted">
            <Link to="/" prefetch="intent" className="text-accent hover:underline">
              {board.entries.length > 0 ? "去题目页面打分" : "去题目页面看看"}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="reveal-tier-2 mt-4 overflow-hidden rounded-card border border-border bg-surface">
            <table id="leaderboard-table" className="w-full table-fixed border-collapse">
              <caption className="sr-only">
                {DIMENSION_LABELS[dimension]}排名，按校准后的平均星级排序
              </caption>
              <thead>
                <tr className="bg-raised/55 text-[11px] font-medium text-muted">
                  <th
                    scope="col"
                    className="w-10 py-2 pl-3 text-left font-medium sm:w-12 sm:pl-4"
                  >
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
                  <th
                    scope="col"
                    className="hidden w-24 py-2 pr-3 text-right font-medium sm:table-cell"
                  >
                    答案 / 题目
                  </th>
                  <th
                    scope="col"
                    className="hidden w-14 py-2 pr-3 text-right font-medium sm:table-cell"
                  >
                    打分
                  </th>
                  <th
                    scope="col"
                    className="w-16 py-2 pr-3 pl-1 text-right font-medium sm:w-28 sm:pr-4"
                  >
                    <span title="按题目难度、打分习惯与样本量校准后的分数">校准分</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, index) => (
                  <Row key={entry.key} entry={entry} index={index} />
                ))}
              </tbody>
            </table>

            {unranked.length > 0 && (
              <div className="border-t border-rule bg-raised/30 px-3 py-2 text-center sm:px-4">
                <button
                  type="button"
                  aria-expanded={showUnranked}
                  aria-controls="leaderboard-table"
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

          {board.votes > 0 && <ScoreMethod baseline={board.baseline} className="mt-4" />}
        </>
      )}
    </div>
  );
}
