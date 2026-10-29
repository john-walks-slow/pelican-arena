import { Star } from "lucide-react";
import { formatStars } from "~/lib/format";
import { cn } from "~/lib/utils";

export function StarScore({
  starSum,
  votes,
  className,
}: {
  starSum: number;
  votes: number;
  className?: string;
}) {
  return (
    <span className={cn("num inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Star
        className={cn("size-3.5", votes ? "fill-accent text-accent" : "text-control")}
        strokeWidth={2}
      />
      <span className={votes ? "font-semibold text-ink" : "text-muted"}>
        {formatStars(starSum, votes)}
      </span>
      <span className="text-[11px] text-muted font-normal">({votes})</span>
    </span>
  );
}
