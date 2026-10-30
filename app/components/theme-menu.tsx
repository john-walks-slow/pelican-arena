import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Moon, Sun, SunMoon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "~/components/ui/button";
import {
  getResolvedTheme,
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "~/lib/theme";
import { cn } from "~/lib/utils";

const OPTIONS = [
  { value: "system", label: "跟随系统", icon: SunMoon },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
] as const;

export function ThemeMenu({ className }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    () => "system" as ThemePreference,
  );
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme, () => "light" as const);
  const CurrentIcon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`外观：${resolved === "dark" ? "深色" : "浅色"}`}
          title="外观"
          className={cn("text-ink hover:bg-raised", className)}
        >
          <CurrentIcon className="size-[17px]" strokeWidth={1.75} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-40 rounded-md border border-border bg-surface p-1 text-ink shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) => setThemePreference(value as ThemePreference)}
          >
            {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-control px-2 text-xs text-muted outline-none transition-colors select-none data-[highlighted]:bg-raised data-[highlighted]:text-ink data-[state=checked]:text-ink"
              >
                <OptionIcon className="size-3.5" strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-3.5 text-accent" strokeWidth={2} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
