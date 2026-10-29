import { Form, Link, useSearchParams, useSubmit } from "react-router";
import type { Route } from "./+types/leaderboard";
import { buildLeaderboard, MIN_SUBMISSIONS } from "~/lib/leaderboard";
import { leaderboardInputs } from "~/lib/queries.server";

export const meta: Route.MetaFunction = () => [
  { title: "榜单 · Pelican Arena" },
  { property: "og:title", content: "Pelican Arena 榜单" },
];

type Board = "model" | "provider" | "pair";

const BOARDS: { id: Board; label: string }[] = [
  { id: "model", label: "模型" },
  { id: "provider", label: "提供方" },
  { id: "pair", label: "模型 × 提供方" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams;
  const board: Board = BOARDS.some((b) => b.id === q.get("board")) ? (q.get("board") as Board) : "model";
  const scope = { vanillaOnly: q.get("all") !== "1", firstOnly: q.get("all") !== "1" };
  const rows = await leaderboardInputs(scope);

  const keyOf = (r: (typeof rows)[number]) =>
    board === "model" ? r.modelId : board === "provider" ? r.providerId : `${r.modelId}|${r.providerId}`;
  const labels = new Map(
    rows.map((r) => [
      keyOf(r),
      board === "model"
        ? { primary: r.modelName, secondary: null }
        : board === "provider"
          ? { primary: r.providerName, secondary: null }
          : { primary: r.modelName, secondary: r.providerName },
    ]),
  );
  const leaderboard = buildLeaderboard(
    rows.map((r) => ({ ...r, groupKey: keyOf(r), votes: Number(r.votes), starSum: Number(r.starSum) })),
  ).map((row) => ({ ...row, ...labels.get(row.groupKey)! }));

  return { board, all: !scope.vanillaOnly, leaderboard };
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const { board, all, leaderboard } = loaderData;
  const [params] = useSearchParams();
  const submit = useSubmit();

  const tabHref = (id: Board) => {
    const next = new URLSearchParams(params);
    next.set("board", id);
    return `?${next}`;
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="text-title font-bold tracking-tight">榜单</h1>
      <p className="mt-1 text-[15px] text-muted">
        {all ? "统计全部答案。" : "只统计没有加增强、第一次生成的答案。"}
        每道题内先排名再跨题平均，至少 {MIN_SUBMISSIONS} 份有评分的答案才上榜。
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <nav className="flex gap-1" aria-label="榜单类型">
          {BOARDS.map((b) => (
            <Link
              key={b.id}
              to={tabHref(b.id)}
              preventScrollReset
              className={`-mb-px border-b-2 px-3 pb-2.5 text-sm ${
                board === b.id ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {b.label}
            </Link>
          ))}
        </nav>
        <Form method="get" onChange={(e) => submit(e.currentTarget, { replace: true, preventScrollReset: true })} className="pb-2">
          <input type="hidden" name="board" value={board} />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="all" value="1" defaultChecked={all} className="accent-accent" />
            包含增强和挑选过的答案
          </label>
        </Form>
      </div>

      {leaderboard.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-control px-6 py-10 text-center text-muted">
          评分还不够，暂时没有条目上榜。
        </div>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="w-12 py-2 font-normal">排名</th>
              <th className="py-2 font-normal">{BOARDS.find((b) => b.id === board)!.label}</th>
              <th className="hidden w-48 py-2 font-normal sm:table-cell">得分</th>
              <th className="num py-2 text-right font-normal">平均星级</th>
              <th className="num hidden py-2 text-right font-normal sm:table-cell">答案</th>
              <th className="num hidden py-2 text-right font-normal sm:table-cell">题目</th>
              <th className="num py-2 text-right font-normal">评分数</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row, i) => (
              <tr key={row.groupKey} className="border-t border-rule">
                <td className="num py-3 text-muted">{i + 1}</td>
                <td className="py-3">
                  <div className="font-medium">{row.primary}</div>
                  {row.secondary && <div className="text-xs text-muted">{row.secondary}</div>}
                </td>
                <td className="hidden py-3 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-accent-track">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${row.score * 100}%` }} />
                    </div>
                    <span className="num w-8 text-right">{Math.round(row.score * 100)}</span>
                  </div>
                </td>
                <td className="num py-3 text-right">{row.avgStars.toFixed(2)}</td>
                <td className="num hidden py-3 text-right sm:table-cell">{row.submissions}</td>
                <td className="num hidden py-3 text-right sm:table-cell">{row.prompts}</td>
                <td className="num py-3 text-right">{row.votes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
