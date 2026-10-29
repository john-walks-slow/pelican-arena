import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { CatalogEntry } from "~/lib/catalog";
import { cn } from "~/lib/utils";

interface ComboboxProps {
  name: string;
  label?: string;
  options: CatalogEntry[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function Combobox({
  name,
  label,
  options,
  value,
  onChange,
  placeholder = "请选择或输入...",
  searchPlaceholder = "搜索或输入新名称...",
  emptyText = "未找到匹配项",
  hint,
  required,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedEntry = options.find(
    (o) => o.name.toLowerCase() === value.toLowerCase(),
  );

  const displayLabel = value || placeholder;
  const isCustomNew =
    query.trim().length > 0 &&
    !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-sm font-medium">{label}</label>}

      {/* Hidden input to ensure FormData gets the chosen/typed value */}
      <input type="hidden" name={name} value={value} required={required} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between bg-surface px-2.5 font-normal text-sm",
              !value && "text-muted/70",
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command loop>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty className="py-3 px-3 text-sm text-center text-muted">
                {emptyText}
              </CommandEmpty>

              {isCustomNew && (
                <CommandGroup heading="自定义">
                  <CommandItem
                    value={query}
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-2 text-accent font-medium"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>使用 &ldquo;{query.trim()}&rdquo;</span>
                  </CommandItem>
                </CommandGroup>
              )}

              <CommandGroup heading="推荐列表">
                {options.map((option) => {
                  const isSelected =
                    value.toLowerCase() === option.name.toLowerCase();
                  return (
                    <CommandItem
                      key={option.id}
                      value={option.name}
                      onSelect={(currentValue) => {
                        onChange(currentValue);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100 text-accent" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
