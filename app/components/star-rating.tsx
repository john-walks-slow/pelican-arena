import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "~/components/ui/toaster";

const LABELS = ["", "很差", "较差", "一般", "不错", "惊艳"];

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
        <div className="flex gap-0.5" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="打分">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="submit"
              name="stars"
              value={value === n ? 0 : n}
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} 星`}
              onMouseEnter={() => setHover(n)}
              className="p-0.5 transition-all active:scale-90 hover:scale-110"
            >
              <Star
                className={`size-7 transition-colors ${
                  n <= shown ? "fill-accent text-accent" : "text-control"
                }`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-muted">
          {hover ? LABELS[hover] : value ? `${value} 星` : ""}
        </span>
      </div>
      <p className="text-[11px] text-muted">
        {value ? "点击相同星级可撤销评分" : "点击星星打分，每份答案限一票"}
      </p>
    </fetcher.Form>
  );
}
