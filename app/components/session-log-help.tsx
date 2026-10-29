import { Check, ChevronDown, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { LOG_SOURCE_LABELS, type LogSource } from "~/lib/session-log";

interface HelpRow {
  label: string;
  value: string;
}

interface ClientHelp {
  id: LogSource;
  rows: HelpRow[];
}

const HELP: ClientHelp[] = [
  {
    id: "claude-code",
    rows: [
      { label: "Linux / macOS", value: "ls -t ~/.claude/projects/*/*.jsonl | head -1" },
      {
        label: "Windows",
        value: String.raw`(Get-ChildItem "$env:USERPROFILE\.claude\projects\*\*.jsonl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`,
      },
    ],
  },
  {
    id: "codex",
    rows: [
      { label: "Linux / macOS", value: "ls -t ~/.codex/sessions/*/*/*/*.jsonl | head -1" },
      {
        label: "Windows",
        value: String.raw`(Get-ChildItem "$env:USERPROFILE\.codex\sessions\*\*\*\*.jsonl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`,
      },
    ],
  },
  {
    id: "pi",
    rows: [
      { label: "Linux / macOS", value: "ls -t ~/.pi/agent/sessions/*/*.jsonl | head -1" },
      {
        label: "Windows",
        value: String.raw`(Get-ChildItem "$env:USERPROFILE\.pi\agent\sessions\*\*.jsonl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`,
      },
    ],
  },
  {
    id: "dsh",
    rows: [
      { label: "Linux / macOS", value: "ls -t ~/.dsh/sessions/*/*/session*.jsonl.zstd | head -1" },
      {
        label: "Windows",
        value: String.raw`(Get-ChildItem "$env:USERPROFILE\.dsh\sessions\*\*\session*.jsonl.zstd" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName`,
      },
    ],
  },
  {
    id: "opencode",
    rows: [
      {
        label: "Linux / macOS",
        value: String.raw`opencode export "$(opencode session list --format json | grep -m1 '"id"' | cut -d'"' -f4)" > ~/opencode-session.json && echo ~/opencode-session.json`,
      },
      {
        label: "Windows",
        value: String.raw`opencode export $((opencode session list --format json | ConvertFrom-Json)[0].id) | Out-File -Encoding utf8 "$env:USERPROFILE\opencode-session.json"; Write-Output "$env:USERPROFILE\opencode-session.json"`,
      },
    ],
  },
];

/** Let long paths break after separators instead of in the middle of a name. */
function CodeValue({ value }: { value: string }) {
  return (
    <>
      {value.split(/([\\/])/).map((part, i) =>
        part === "/" || part === "\\" ? (
          <span key={i}>
            {part}
            <wbr />
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function CopyRow({ label, value }: HelpRow) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const codeRef = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setStatus("已复制");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const range = document.createRange();
      if (codeRef.current) {
        range.selectNodeContents(codeRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setStatus("复制失败，已选中文本");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{label}</span>
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
      <code
        ref={codeRef}
        className="mt-0.5 block font-mono text-[11px] leading-relaxed break-words select-all"
      >
        <CodeValue value={value} />
      </code>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}

export function SessionLogHelp() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<LogSource>("claude-code");
  const help = HELP.find((h) => h.id === active) ?? HELP[0];

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-xs font-medium">如何获取日志文件？</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <>
          <div className="mt-2 overflow-hidden rounded-control border border-border bg-surface">
            <div
              role="tablist"
              aria-label="客户端"
              className="flex flex-wrap gap-0.5 border-b border-border bg-raised px-1.5 py-1.5"
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
              className="space-y-2.5 px-3 py-2.5"
            >
              {help.rows.map((row) => (
                <CopyRow key={row.label} {...row} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
