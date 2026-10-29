import { cn } from "~/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** A small switch between two or three views, sized to sit in a section header. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-control border border-control bg-raised p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-full rounded-[4px] px-2.5 text-xs whitespace-nowrap transition-colors",
              active
                ? "bg-surface font-medium text-ink"
                : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
