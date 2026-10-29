import { Markdown } from "~/components/markdown";
import { formatBytes, type BundleEntry } from "~/lib/bundle";
import type { PromptKind } from "~/lib/kinds";
import { SANDBOX } from "~/lib/sandbox";

function decodePreviewText(data: Uint8Array, maxBytes = 64 * 1024) {
  const slice = data.byteLength > maxBytes ? data.subarray(0, maxBytes) : data;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  return data.byteLength > maxBytes ? `${text}\n…` : text;
}

/** A compact preview of the picked bundle, before it is uploaded. */
export function InlineWorkPreview({
  kind,
  entries,
  name,
}: {
  kind: PromptKind;
  entries: BundleEntry[];
  name: string;
}) {
  if (kind === "web") {
    if (entries.length > 1) {
      return (
        <ul className="flex-1 space-y-0.5 overflow-auto scroll-thin border-t border-border bg-surface px-3 py-2 font-mono text-xs text-muted">
          {entries.map((entry) => (
            <li key={entry.path} className="flex justify-between gap-4">
              <span className="truncate">{entry.path}</span>
              <span className="num shrink-0">{formatBytes(entry.data.byteLength)}</span>
            </li>
          ))}
        </ul>
      );
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(entries[0].data);
    return (
      <div className="flex min-h-[260px] flex-1 border-t border-border bg-white">
        <iframe
          srcDoc={html}
          title={`${name} 预览`}
          sandbox={SANDBOX}
          allow="fullscreen; autoplay"
          referrerPolicy="no-referrer"
          className="size-full border-0"
        />
      </div>
    );
  }
  if (kind === "markdown") {
    const md = decodePreviewText(entries[0].data, 256 * 1024);
    return (
      <div className="flex-1 overflow-auto scroll-thin border-t border-border bg-surface px-3.5 py-3">
        <Markdown>{md}</Markdown>
      </div>
    );
  }
  if (kind === "svg") {
    const svgText = new TextDecoder("utf-8", { fatal: false }).decode(entries[0].data);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    return (
      <div className="flex flex-1 items-center justify-center border-t border-border bg-white p-3.5">
        <img src={src} alt={name} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  const snippet = decodePreviewText(entries[0].data, 16 * 1024);
  return (
    <pre className="flex-1 overflow-auto scroll-thin border-t border-border bg-ground/50 px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre text-muted">
      <code>{snippet}</code>
    </pre>
  );
}
