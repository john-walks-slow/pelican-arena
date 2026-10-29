import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";

/**
 * Appends the next page when it scrolls into view, with a button as the
 * explicit fallback.
 */
export function LoadMore({
  hasMore,
  loading,
  onLoad,
  shown,
  total,
  noun,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  shown: number;
  total: number;
  noun: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onLoad(),
      { rootMargin: "600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoad]);

  if (!hasMore) {
    return total > 0 ? (
      <p className="num mt-6 text-center text-xs text-muted">
        已显示全部 {total} {noun}
      </p>
    ) : null;
  }

  return (
    <div ref={sentinel} className="mt-6 flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onLoad}
        disabled={loading}
        className="gap-1.5"
      >
        {loading && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
        {loading ? "加载中…" : "加载更多"}
      </Button>
      <span className="num text-[11px] text-muted">
        {shown} / {total}
      </span>
    </div>
  );
}
