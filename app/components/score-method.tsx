import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MIN_VOTES } from "~/lib/leaderboard";
import { cn } from "~/lib/utils";

const NOTES = [
  {
    title: "题目难度",
    body: "有的题所有答案都得低分。分数里扣掉每道题的整体偏移，只比同题内的高下，专攻难题不吃亏。",
  },
  {
    title: "打分习惯",
    body: "有人惯常给五星，有人惯常给三星。每位打分者的松紧程度单独估计并扣除，一个人刷不出一个榜。",
  },
  {
    title: "样本量",
    body: `票少的条目向全站均分收缩，票越多越接近它的真实水平；不足 ${MIN_VOTES} 票的条目不参与排名。`,
  },
  {
    title: "覆盖面",
    body: "同一道题最多算五票的分量，跨越的题目越多，得到的权重越大。只在一道题上好看，撑不起一个名次。",
  },
  {
    title: "误差带",
    body: "分数旁的长条是它可能落在的范围。两行的范围叠在一起，说明现有票数还分不出高下，名次挨着也只是先后之差。",
  },
];

/** Explains how the calibrated score differs from a plain average. */
export function ScoreMethod({
  baseline,
  className,
}: {
  baseline: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className={cn("rounded-card border border-border bg-surface", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">分数怎么来的</h2>
          <p className="mt-0.5 text-xs text-muted">
            答案由坛友自行生成上传，打分也来自坛友。校准分以全站均分{" "}
            <span className="num">{baseline.toFixed(2)}</span> 为基准。
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div className="border-t border-rule px-4 py-3.5">
          <dl className="grid gap-3 sm:grid-cols-2">
            {NOTES.map((note) => (
              <div key={note.title}>
                <dt className="text-xs font-medium text-ink">{note.title}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted">{note.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3.5 border-t border-rule pt-3 text-xs leading-relaxed text-muted">
            模型、提供方和客户端都由提交者自己填写，平台无法核实，也不代跑模型。校准只能消掉打分一侧的系统性偏差，消不掉选题口味和样本本身的偏好，结果仅供参考。
          </p>
        </div>
      )}
    </section>
  );
}
