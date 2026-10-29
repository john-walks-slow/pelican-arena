import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

export interface CompactSelectOption {
  value: string;
  label: string;
}

/** Small select used for toolbars; matches the filter trigger styling. */
export function CompactSelect({
  value,
  options,
  onChange,
  label,
  icon,
  className,
}: {
  value: string;
  options: CompactSelectOption[];
  onChange: (value: string) => void;
  label: string;
  /** Leading glyph naming the dimension being filtered. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-8 w-auto gap-1.5 rounded-control px-2.5 text-xs text-muted", className)}
      >
        {icon && <span className="shrink-0 opacity-60">{icon}</span>}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
