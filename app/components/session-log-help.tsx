import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "~/components/ui/toaster";
import { LOG_SOURCE_LABELS, type LogSource } from "~/lib/session-log";

interface HelpRow {
  label: string;
  value: string;
}

interface ClientHelp {
  id: LogSource;
  rows: HelpRow[];
  note: string;
}

const HELP: ClientHelp[] = [
  {
    id: "claude-code",
    rows: [
      { label: "文件", value: "~/.claude/projects/<项目目录>/<会话 ID>.jsonl" },
      { label: "最近一次", value: "ls -t ~/.claude/projects/*/*.jsonl | head -1" },
    ],
    note: "项目目录名由工作路径生成，路径里的 / 会变成 -。",
  },
  {
    id: "codex",
    rows: [
      { label: "文件", value: "~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl" },
      { label: "最近一次", value: "ls -t ~/.codex/sessions/*/*/*/*.jsonl | head -1" },
    ],
    note: "按日期分目录存放，选最近修改的那个。",
  },
  {
    id: "pi",
    rows: [
      { label: "文件", value: "~/.pi/agent/sessions/<项目目录>/<时间>_<会话 ID>.jsonl" },
      { label: "最近一次", value: "ls -t ~/.pi/agent/sessions/*/*.jsonl | head -1" },
    ],
    note: "选最近修改的那个文件。",
  },
  {
    id: "dsh",
    rows: [
      { label: "文件", value: "~/.dsh/sessions/<项目目录>/<会话 ID>/session.v*.jsonl.zstd" },
      { label: "最近一次", value: "ls -t ~/.dsh/sessions/*/*/session*.jsonl.zstd | head -1" },
    ],
    note: "压缩日志可以直接选，会在浏览器里解开。",
  },
  {
    id: "opencode",
    rows: [
      { label: "列出会话", value: "opencode session list" },
      { label: "导出", value: "opencode export <会话 ID> > session.json" },
    ],
    note: "上传导出的 JSON，导出文件较大，但解析后只上传统计。",
  },
];

/** Prefer breaking paths after slashes instead of inside a placeholder like <会话 ID>. */
function CodeValue({ value }: { value: string }) {
  if (!value.includes("/")) return <>{value}</>;
  return (
    <>
      {value.split("/").map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <>
              /<wbr />
            </>
          )}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </>
  );
}

function CopyRow({ label, value }: HelpRow) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  }

  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 pt-px text-[11px] text-muted">{label}</span>
      <code className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed break-words select-all">
        <CodeValue value={value} />
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`复制${label}`}
        className="-my-1 grid size-6 shrink-0 place-items-center rounded text-muted hover:bg-raised hover:text-ink"
      >
        {copied ? (
          <Check className="size-3.5 text-positive" strokeWidth={2} />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

export function SessionLogHelp() {
  const [active, setActive] = useState<LogSource>("claude-code");
  const help = HELP.find((h) => h.id === active) ?? HELP[0];

  return (
    <div className="mt-4">
      <h3 className="text-xs font-medium">日志文件在哪</h3>
      <div className="mt-2 overflow-hidden rounded-control border border-border">
        <div
          role="tablist"
          aria-label="客户端"
          className="flex flex-wrap gap-0.5 border-b border-border bg-raised/60 px-1.5 py-1.5"
        >
          {HELP.map((client) => {
            const selected = client.id === active;
            return (
              <button
                key={client.id}
                type="button"
                role="tab"
                id={`log-tab-${client.id}`}
                aria-selected={selected}
                aria-controls="log-help-panel"
                onClick={() => setActive(client.id)}
                className={`h-6 rounded px-2 text-[11px] transition-colors ${
                  selected
                    ? "border border-border bg-surface font-medium text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {LOG_SOURCE_LABELS[client.id]}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id="log-help-panel"
          aria-labelledby={`log-tab-${active}`}
          className="space-y-1.5 px-3 py-2.5"
        >
          {help.rows.map((row) => (
            <CopyRow key={row.label} {...row} />
          ))}
          <p className="pt-0.5 text-[11px] text-muted">{help.note}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Windows 上把 ~ 换成 %USERPROFILE%</p>
    </div>
  );
}
