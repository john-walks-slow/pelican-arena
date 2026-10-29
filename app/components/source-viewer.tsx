import { File, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes, type BundleFile } from "~/lib/bundle";

const TEXT_TYPES = /^(text\/|application\/(json|xml)|image\/svg)/;
const PREVIEW_LIMIT = 512 * 1024;

/** File list and source view for a submission bundle, read from usercontent. */
export function SourceViewer({ files, baseUrl }: { files: BundleFile[]; baseUrl: string }) {
  const [path, setPath] = useState(files.find((f) => f.path === "index.html")?.path ?? files[0]?.path);
  const [content, setContent] = useState<{ path: string; text: string } | null>(null);
  const file = files.find((f) => f.path === path);
  const isText = file && TEXT_TYPES.test(file.type) && file.size <= PREVIEW_LIMIT;

  useEffect(() => {
    if (!file || !isText) return;
    let cancelled = false;
    fetch(`${baseUrl}${file.path}`)
      .then((r) => r.text())
      .then((text) => !cancelled && setContent({ path: file.path, text }));
    return () => {
      cancelled = true;
    };
  }, [baseUrl, file, isText]);

  return (
    <div className={`grid min-h-80 ${files.length > 1 ? "md:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
      {files.length > 1 && (
        <ul className="max-h-[560px] overflow-y-auto border-b border-border p-2 md:border-r md:border-b-0">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setPath(f.path)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] ${
                  f.path === path ? "bg-active font-medium text-ink" : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <File className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{f.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="min-w-0">
        {file && (
          <div className="flex h-9 items-center justify-between border-b border-border px-4 text-xs text-muted">
            <span className="truncate">{file.path}</span>
            <span className="num shrink-0">{formatBytes(file.size)}</span>
          </div>
        )}
        {!file ? null : !isText ? (
          <div className="p-6 text-sm text-muted">
            无法预览这个文件。
            <a href={`${baseUrl}${file.path}`} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
              在新标签页打开
            </a>
          </div>
        ) : content?.path !== file.path ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            读取中
          </div>
        ) : (
          <pre className="max-h-[560px] overflow-auto p-4 font-mono text-xs leading-5 text-ink">
            <code>{content.text}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
