import { cn } from "~/lib/utils";

export function PreviewSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "skeleton-shimmer absolute inset-0 flex flex-col justify-between p-3.5 select-none",
        className,
      )}
    >
      {/* 模拟顶栏与导航 */}
      <div className="flex items-center justify-between border-b border-rule/80 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="size-1.5 rounded-full bg-border" />
          <div className="size-1.5 rounded-full bg-border" />
          <div className="size-1.5 rounded-full bg-border" />
        </div>
        <div className="h-2 w-20 rounded-full bg-border/70 sm:w-28" />
        <div className="h-2 w-5 rounded-full bg-border/40" />
      </div>

      {/* 模拟主体内容轮廓 */}
      <div className="my-auto space-y-2 py-1.5">
        <div className="h-3 w-3/5 rounded bg-border/80" />
        <div className="h-2 w-4/5 rounded bg-border/50" />
        <div className="h-2 w-2/3 rounded bg-border/50" />
      </div>

      {/* 底部模拟卡片分块 */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="h-6 rounded-control bg-border/40 sm:h-7" />
        <div className="h-6 rounded-control bg-border/40 sm:h-7" />
      </div>
    </div>
  );
}
