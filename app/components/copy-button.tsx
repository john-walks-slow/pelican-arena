import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="size-4 text-positive" strokeWidth={2} />
      ) : (
        <Copy className="size-4" strokeWidth={1.75} />
      )}
      {copied ? "已复制" : label}
    </button>
  );
}
