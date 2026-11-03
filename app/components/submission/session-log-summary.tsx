import { estimateCost, formatCost, type ModelCost } from "~/lib/cost";
import { formatCount, formatDuration } from "~/lib/format";
import { LOG_SOURCE_LABELS, totalTokens, type LogMeta } from "~/lib/session-log";

export function SessionLogSummary({
  meta,
  cost,
}: {
  meta: LogMeta;
  cost?: ModelCost | null;
}) {
  const estimatedCost = estimateCost(meta, cost);
  const rows = [
    ["来源", LOG_SOURCE_LABELS[meta.source]],
    ["模型", meta.models.join("、") || "—"],
    ["总 token", formatCount(totalTokens(meta))],
    ["输入 / 输出", `${formatCount(meta.inputTokens)} / ${formatCount(meta.outputTokens)}`],
    ["缓存读取", formatCount(meta.cacheReadTokens)],
    ...(estimatedCost != null ? [["预估成本", formatCost(estimatedCost)]] : []),
    ["用时", meta.durationMs == null ? "—" : formatDuration(meta.durationMs)],
    ["轮数 / 工具调用", `${Math.max(meta.turns, 1)} / ${meta.toolCalls}`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted">{key}</dt>
          <dd className="num truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
