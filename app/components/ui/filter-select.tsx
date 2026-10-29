import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter control with a searchable list. Value "" means "all".
 * Used where the catalog can grow past what a native select can show.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  searchPlaceholder,
  className,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs transition-colors",
            value
              ? "border-ink/25 bg-raised font-medium text-ink"
              : "border-control bg-surface text-muted hover:bg-raised hover:text-ink",
            className,
          )}
        >
          <span className="max-w-40 truncate">{current?.label ?? label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command loop>
          <CommandInput
            placeholder={searchPlaceholder ?? `搜索${label}`}
            value={query}
            onValueChange={setQuery}
            className="h-9"
          />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-center text-xs text-muted">没有匹配项</CommandEmpty>
            <CommandItem
              value={`__all_${label}`}
              onSelect={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className="text-xs"
            >
              <Check
                className={cn("mr-2 size-3.5", value ? "opacity-0" : "text-accent")}
                strokeWidth={2.5}
              />
              全部{label}
            </CommandItem>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
                className="text-xs"
              >
                <Check
                  className={cn(
                    "mr-2 size-3.5",
                    value === option.value ? "text-accent" : "opacity-0",
                  )}
                  strokeWidth={2.5}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
