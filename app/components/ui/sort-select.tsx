import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

export interface SortOption {
  value: string;
  label: string;
}

/** Compact sort dropdown, visually aligned with FilterSelect. */
export function SortSelect({
  value,
  options,
  onChange,
  label = "排序",
  className,
}: {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-8 w-auto gap-1.5 rounded-control px-2.5 text-xs text-muted", className)}
      >
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
