export function SectionHeading({
  title,
  badge,
  hint,
  aside,
}: {
  title: string;
  badge?: React.ReactNode;
  hint?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="shrink-0 text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
        {badge}
        {hint && <span className="truncate text-xs text-muted">{hint}</span>}
      </div>
      {aside}
    </div>
  );
}
