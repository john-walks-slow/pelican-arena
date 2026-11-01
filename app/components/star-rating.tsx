import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "~/components/ui/toaster";
import { calculateRatingFromRatio, formatRatingLabel } from "~/lib/rating";

export function StarRating({
  current,
  disabledReason,
}: {
  current: number | null;
  disabledReason?: string;
}) {
  const fetcher = useFetcher<{ stars: number } | { error: string }>();
  const [hover, setHover] = useState(0);
  const [optimistic, setOptimistic] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const result = fetcher.data;
    if (!result) return;
    setOptimistic(null);
    setHover(0);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.stars) toast.success(`已评 ${result.stars} 星`);
    else toast("评分已取消");
  }, [fetcher.data]);

  useEffect(() => {
    setOptimistic(null);
  }, [current]);

  const pending = fetcher.formData ? Number(fetcher.formData.get("stars")) : null;
  const value = optimistic ?? pending ?? current ?? 0;
  const shown = hover || value;

  const commitRating = (stars: number) => {
    setOptimistic(stars);
    setHover(0);
    fetcher.submit({ intent: "rate", stars: String(stars) }, { method: "post" });
  };

  const getScoreFromClientX = (clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return calculateRatingFromRatio(ratio);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabledReason) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const score = getScoreFromClientX(e.clientX);
    setHover(score);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabledReason) return;

    if (isDraggingRef.current) {
      const dist = Math.hypot(
        e.clientX - startPosRef.current.x,
        e.clientY - startPosRef.current.y,
      );
      if (dist > 8) {
        hasMovedRef.current = true;
      }
      const score = getScoreFromClientX(e.clientX);
      setHover(score);
    } else if (e.pointerType === "mouse") {
      const score = getScoreFromClientX(e.clientX);
      setHover(score);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const targetScore = getScoreFromClientX(e.clientX);

    // 未明显拖动且点击相同星级 -> 撤销为 0 分
    if (!hasMovedRef.current && targetScore === value) {
      commitRating(0);
    } else {
      commitRating(targetScore);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setHover(0);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current && e.pointerType === "mouse") {
      setHover(0);
    }
  };

  if (disabledReason) {
    return (
      <div className="rounded-md bg-raised/60 px-3 py-2 text-center text-xs font-medium text-muted">
        {disabledReason}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          className="relative flex cursor-pointer touch-none select-none items-center gap-0.5 py-0.5"
          role="radiogroup"
          aria-label="打分"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const halfVal = n - 0.5;
            const fullVal = n;
            const isFull = shown >= fullVal;
            const isHalf = !isFull && shown >= halfVal;

            return (
              <div key={n} className="relative p-0.5">
                <div className="relative size-7">
                  {/* 底层空心星 */}
                  <Star className="size-7 text-control transition-colors" strokeWidth={1.5} />

                  {/* 顶层实心金色填充 */}
                  {isFull && (
                    <div className="pointer-events-none absolute inset-0">
                      <Star className="size-7 fill-accent text-accent" strokeWidth={1.5} />
                    </div>
                  )}
                  {isHalf && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                      <Star className="size-7 max-w-none fill-accent text-accent" strokeWidth={1.5} />
                    </div>
                  )}

                  {/* 键盘无障碍交互按钮 (左半星 n - 0.5) */}
                  <button
                    type="button"
                    tabIndex={0}
                    role="radio"
                    aria-checked={value === halfVal}
                    aria-label={`${halfVal} 星`}
                    onClick={() => commitRating(value === halfVal ? 0 : halfVal)}
                    className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/2 opacity-0 focus-visible:opacity-100 focus-visible:bg-accent/15 focus-visible:outline-none focus-visible:rounded-l"
                  />

                  {/* 键盘无障碍交互按钮 (右半星 n) */}
                  <button
                    type="button"
                    tabIndex={0}
                    role="radio"
                    aria-checked={value === fullVal}
                    aria-label={`${fullVal} 星`}
                    onClick={() => commitRating(value === fullVal ? 0 : fullVal)}
                    className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/2 opacity-0 focus-visible:opacity-100 focus-visible:bg-accent/15 focus-visible:outline-none focus-visible:rounded-r"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <span className="text-xs font-medium text-muted">
          {hover ? formatRatingLabel(hover) : value ? formatRatingLabel(value) : ""}
        </span>
      </div>
      <p className="text-[11px] text-muted">
        {value ? "点击相同星级可撤销评分" : "点击或滑动星星打分，每份答案限一票"}
      </p>
    </div>
  );
}
