import { Upload } from "lucide-react";
import type { ComponentType } from "react";
import { useRef, useState } from "react";

/** Click, keyboard, and drag-and-drop entry for a single bundle file. */
export function FileDropZone({
  accept,
  label,
  hint,
  error,
  icon: Icon = Upload,
  onPick,
  className = "min-h-[168px] flex-1",
}: {
  accept: string;
  label: string;
  hint: string;
  error?: string | null;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  onPick: (file: File) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onPick(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border border-dashed px-5 py-8 text-center transition-colors ${className} ${
          dragging ? "border-accent bg-accent-soft" : "border-control hover:bg-raised/60"
        }`}
      >
        <Icon className="size-4 text-muted pointer-events-none" strokeWidth={1.75} />
        <div className="text-sm font-medium pointer-events-none">{label}</div>
        <div className="text-xs text-muted pointer-events-none">{hint}</div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-negative">{error}</p>}
    </div>
  );
}
