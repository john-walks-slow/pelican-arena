import { Star } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

const LABELS = ["", "很差", "较差", "一般", "不错", "惊艳"];

export function StarRating({ current, disabledReason }: { current: number | null; disabledReason?: string }) {
  const fetcher = useFetcher();
  const [hover, setHover] = useState(0);
  const pending = fetcher.formData ? Number(fetcher.formData.get("stars")) : null;
  const value = pending ?? current ?? 0;
  const shown = hover || value;

  if (disabledReason) {
    return <p className="text-sm text-muted">{disabledReason}</p>;
  }

  return (
    <fetcher.Form method="post" className="flex items-center gap-3">
      <input type="hidden" name="intent" value="rate" />
      <div className="flex" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="打分">
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
            className="p-0.5 transition-transform active:scale-90"
          >
            <Star
              className={`size-7 transition-colors ${n <= shown ? "fill-accent text-accent" : "text-control"}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted">
        {hover ? LABELS[hover] : value ? `你打了 ${value} 星，再点一次取消` : "还没打分"}
      </span>
    </fetcher.Form>
  );
}
