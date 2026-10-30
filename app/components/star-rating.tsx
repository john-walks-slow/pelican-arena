import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "~/components/ui/toaster";
import { formatRatingLabel } from "~/lib/rating";

export function StarRating({
  current,
  disabledReason,
}: {
  current: number | null;
  disabledReason?: string;
}) {
  const fetcher = useFetcher<{ stars: number }>();
  const [hover, setHover] = useState(0);

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.stars) toast.success(`已评 ${fetcher.data.stars} 星`);
    else toast("评分已取消");
  }, [fetcher.data]);

  const pending = fetcher.formData ? Number(fetcher.formData.get("stars")) : null;
  const value = pending ?? current ?? 0;
  const shown = hover || value;

  if (disabledReason) {
    return (
      <div className="rounded-md bg-raised/60 px-3 py-2 text-center text-xs font-medium text-muted">
        {disabledReason}
      </div>
    );
  }

  return (
    <fetcher.Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="rate" />
      <div className="flex items-center gap-2">
        <div
          className="flex gap-0.5"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="打分"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const halfVal = n - 0.5;
            const fullVal = n;
            const isFull = shown >= fullVal;
            const isHalf = !isFull && shown >= halfVal;

            return (
              <div
                key={n}
                className="group relative p-0.5 transition-transform active:scale-90 hover:scale-110"
              >
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

                  {/* 左半星交互按钮 (n - 0.5) */}
                  <button
                    type="submit"
                    name="stars"
                    value={value === halfVal ? 0 : halfVal}
                    role="radio"
                    aria-checked={value === halfVal}
                    aria-label={`${halfVal} 星`}
                    onMouseEnter={() => setHover(halfVal)}
                    className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:bg-accent/15 focus-visible:outline-none focus-visible:rounded-l"
                  />

                  {/* 右半星交互按钮 (n) */}
                  <button
                    type="submit"
                    name="stars"
                    value={value === fullVal ? 0 : fullVal}
                    role="radio"
                    aria-checked={value === fullVal}
                    aria-label={`${fullVal} 星`}
                    onMouseEnter={() => setHover(fullVal)}
                    className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:bg-accent/15 focus-visible:outline-none focus-visible:rounded-r"
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
        {value ? "点击相同星级可撤销评分" : "点击星星打分，每份答案限一票"}
      </p>
    </fetcher.Form>
  );
}
