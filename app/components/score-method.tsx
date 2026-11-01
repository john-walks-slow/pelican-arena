import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MIN_VOTES } from "~/lib/leaderboard";
import { cn } from "~/lib/utils";

const NOTES = [
  {
    title: "同题对照",
    body: "只在同一道题的答案之间比，题目本身的难易因此被扣除；和谁同台过，就只在那些题里评。不同客户端、不同提供方算在一起，比的是实际搭配下的表现。",
  },
  {
    title: "打分习惯",
    body: "有人惯常给五星，有人惯常给三星。每位打分者的松紧单独估计再扣除，减少一两个人口味影响全榜。",
  },
  {
    title: "样本量",
    body: `票少的条目向平均分收缩，避免一两票冲上榜首；没攒够 ${MIN_VOTES} 个人打分的条目不参与排名。`,
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
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-ink">分数怎么来的</span>
            <span className="mt-0.5 block text-xs font-normal text-muted">
              答案由坛友自行生成上传，打分也来自坛友。校准分以当前范围的均分{" "}
              <span className="num">{baseline.toFixed(2)}</span> 为基准。
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
            strokeWidth={1.75}
          />
        </button>
      </h2>

      {open && (
        <div className="border-t border-rule px-4 py-3.5">
          <dl className="grid gap-3 sm:grid-cols-3">
            {NOTES.map((note) => (
              <div key={note.title}>
                <dt className="text-xs font-medium text-ink">{note.title}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted">{note.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3.5 border-t border-rule pt-3 text-xs leading-relaxed text-muted">
            分数线仍然是 1–5 星，只是含义从「平均给了几星」变成「扣掉题目和打分者因素后，比一般水平好多少」。模型、提供方和客户端都由提交者自己填写，平台无法核实，也不代跑模型；同一模型交得多、题目挑得顺手，同样会影响名次，结果仅供参考。
          </p>
        </div>
      )}
    </section>
  );
}
