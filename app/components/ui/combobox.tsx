import * as React from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
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
import {
  PROVIDER_CATEGORIES,
  providerCategoryLabel,
  type CatalogEntry,
  type CatalogKind,
} from "~/lib/catalog";
import { cn } from "~/lib/utils";

interface ComboboxProps {
  name?: string;
  label?: string;
  options: CatalogEntry[];
  value: string;
  onChange: (value: string) => void;
  /** When set, the list is searched remotely instead of shipping the whole catalog. */
  kind?: CatalogKind;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  hint?: React.ReactNode;
  required?: boolean;
  /** Leading glyph naming the catalog being picked from. */
  icon?: React.ReactNode;
  /** field: full-width form control. chip: inline pill that sits with other tags. */
  trigger?: "field" | "chip";
  className?: string;
}

export function Combobox({
  name,
  label,
  options,
  value,
  onChange,
  kind,
  placeholder = "请选择或输入...",
  searchPlaceholder = "搜索或输入新名称...",
  emptyText = "未找到匹配项",
  hint,
  required,
  icon,
  trigger = "field",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [list, setList] = React.useState<CatalogEntry[]>(options);
  const [total, setTotal] = React.useState(options.length);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setList(options);
    setTotal(options.length);
    setQuery("");
  }, [open, options]);

  React.useEffect(() => {
    if (!open || !kind) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        fetch(`/api/catalog?kind=${kind}&q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((raw: unknown) => {
            const data = raw as { items?: CatalogEntry[]; total?: number } | null;
            if (!data || controller.signal.aborted) return;
            if (Array.isArray(data?.items))
              setList(
                data.items.map(({ id, name, category, reasoning }) => ({
                  id,
                  name,
                  category,
                  reasoning,
                })),
              );
            if (typeof data?.total === "number") setTotal(data.total);
          })
          .catch(() => {})
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      setLoading(false);
    };
  }, [open, kind, query]);

  const selectedEntry = list.find((o) => o.name.toLowerCase() === value.toLowerCase());
  const displayLabel = value || placeholder;
  const showSelected = Boolean(value && !selectedEntry);
  const isChip = trigger === "chip";
  const isCustomNew =
    query.trim().length > 0 &&
    !list.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  const groups = React.useMemo(() => {
    if (!list.some((option) => option.category)) return null;
    const order: string[] = PROVIDER_CATEGORIES.map((category) => category.id);
    const buckets = new Map<string, CatalogEntry[]>();
    for (const option of list) {
      const key = option.category ?? "other";
      buckets.set(key, [...(buckets.get(key) ?? []), option]);
    }
    return [...buckets.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [list]);

  function renderOption(option: CatalogEntry) {
    const isSelected = value.toLowerCase() === option.name.toLowerCase();
    return (
      <CommandItem
        key={option.id}
        value={kind ? `${option.name}__${option.id}` : option.name}
        onSelect={() => {
          onChange(option.name);
          setOpen(false);
          setQuery("");
        }}
      >
        <Check
          className={cn(
            "mr-2 h-4 w-4",
            isSelected ? "text-accent opacity-100" : "opacity-0",
          )}
        />
        <span className="truncate">{option.name}</span>
      </CommandItem>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className={cn("block text-xs font-medium text-muted", isChip && "sr-only")}>
          {label}
        </label>
      )}

      {/* Hidden input to ensure FormData gets the chosen/typed value */}
      <input type="hidden" name={name} value={value} required={required} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={isChip ? "ghost" : "outline"}
            role="combobox"
            aria-expanded={open}
            className={cn(
              isChip
                ? "h-7 gap-1 rounded-full border border-dashed border-control px-2.5 text-xs font-normal text-muted hover:border-ink/25 hover:bg-raised hover:text-ink"
                : "w-full justify-between bg-surface px-2.5 font-normal text-sm",
              !isChip && !value && "text-muted/70",
            )}
          >
            {isChip ? (
              icon ?? <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
            ) : (
              icon && <span className="shrink-0 opacity-60">{icon}</span>
            )}
            <span className={cn("truncate", !isChip && "min-w-0 flex-1 text-left")}>
              {displayLabel}
            </span>
            {!isChip && (
              <ChevronDown
                className={cn(
                  "ml-2 size-3.5 shrink-0 opacity-50 transition-transform duration-200 motion-reduce:transition-none",
                  open && "rotate-180",
                )}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
          align="start"
        >
          <Command loop shouldFilter={!kind}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              loading={loading}
            />
            <CommandList>
              <CommandEmpty
                className={cn(
                  "px-3 py-3 text-center text-sm text-muted",
                  loading && "hidden",
                )}
              >
                {emptyText}
              </CommandEmpty>

              {showSelected && (
                <CommandGroup heading="当前">
                  <CommandItem
                    value={`__selected_${value}`}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className="mr-2 h-4 w-4 text-accent" />
                    <span className="truncate">{value}</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {isCustomNew && (
                <CommandGroup heading="自定义">
                  <CommandItem
                    value={`__custom_${query.trim()}`}
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-2 font-medium text-accent"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>使用 &ldquo;{query.trim()}&rdquo;</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {groups
                ? groups.map(([category, options]) => (
                    <CommandGroup key={category} heading={providerCategoryLabel(category)}>
                      {options.map(renderOption)}
                    </CommandGroup>
                  ))
                : <CommandGroup>{list.map(renderOption)}</CommandGroup>}
            </CommandList>
            {kind && total > list.length && (
              <p className="border-t border-rule px-3 py-1.5 text-[11px] text-muted">
                共 {total} 项，继续输入以搜索
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
