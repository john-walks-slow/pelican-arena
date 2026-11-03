import { OUTPUT_REQUIREMENTS_TITLE, outputRequirements } from "~/lib/output-requirements";
import type { PromptKind } from "~/lib/kinds";
import { cn } from "~/lib/utils";

/** The output requirements appended after the author's prompt, shown wherever the prompt is. */
export function OutputRequirements({
  kind,
  allowSearch = false,
  allowLibraries = false,
  className,
}: {
  kind: PromptKind;
  allowSearch?: boolean;
  allowLibraries?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-rule pt-3", className)}>
      <p className="text-[11px] font-medium text-muted">{OUTPUT_REQUIREMENTS_TITLE}</p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
        {outputRequirements(kind, { allowSearch, allowLibraries }).map((note) => (
          <li key={note} className="flex gap-1.5">
            <span aria-hidden className="text-control">
              ·
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
