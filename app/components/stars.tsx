import { Star } from "lucide-react";
import { formatStars } from "~/lib/format";

export function StarScore({ starSum, votes }: { starSum: number; votes: number }) {
  return (
    <span className="num inline-flex items-center gap-1 text-sm">
      <Star
        className={`size-3.5 ${votes ? "fill-accent text-accent" : "text-control"}`}
        strokeWidth={1.75}
      />
      <span className={votes ? "font-medium text-ink" : "text-muted"}>{formatStars(starSum, votes)}</span>
      <span className="text-xs text-muted">({votes})</span>
    </span>
  );
}
