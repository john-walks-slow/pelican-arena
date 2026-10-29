import { FileArchive, FileCode2, FileText, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatBytes } from "~/lib/bundle";
import type { PromptKind } from "~/lib/kinds";
import type { PickedBundle } from "~/lib/use-file-bundle";

export function PickedBundleCard({
  picked,
  kind,
  onRemove,
}: {
  picked: PickedBundle;
  kind: PromptKind;
  onRemove: () => void;
}) {
  const Icon =
    kind !== "web" ? FileText : picked.entries.length > 1 ? FileArchive : FileCode2;
  const total = picked.entries.reduce((sum, entry) => sum + entry.data.byteLength, 0);

  return (
    <div className="flex shrink-0 items-center gap-2.5 px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{picked.name}</div>
        <div className="num text-xs text-muted">
          {picked.entries.length} 个文件 · {formatBytes(total)}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="移除"
        onClick={onRemove}
      >
        <X className="size-4" strokeWidth={1.75} />
      </Button>
    </div>
  );
}
