import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Avatar } from "~/components/avatar";
import { Markdown } from "~/components/markdown";
import { ModerationActions } from "~/components/moderation-actions";
import { OutputRequirements } from "~/components/output-requirements";
import { Button } from "~/components/ui/button";
import { formatRelative } from "~/lib/format";
import { KIND_META } from "~/lib/kinds";

export interface PendingPrompt {
  id: string;
  title: string;
  body: string;
  kind: "web" | "markdown" | "svg";
  allowSearch?: boolean;
  allowLibraries?: boolean;
  createdAt: Date;
  author: { id: number; username: string; avatarTemplate: string | null; trustLevel: number };
  history: { approved: number; rejected: number };
}

export function PromptReviewCard({ prompt }: { prompt: PendingPrompt }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = bodyRef.current;
    if (!element || expanded) return;
    const check = () => setOverflowing(element.scrollHeight > element.clientHeight + 8);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    void document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [expanded, prompt.body]);

  return (
    <article className="rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="rounded bg-raised px-1.5 py-0.5">{KIND_META[prompt.kind].label}</span>
            <span className="rounded bg-raised px-1.5 py-0.5">{prompt.allowSearch ? "允许联网" : "禁止联网"}</span>
            {prompt.kind !== "markdown" && (
              <span className="rounded bg-raised px-1.5 py-0.5">
                {prompt.allowLibraries ? "允许外部库" : "禁止外部库"}
              </span>
            )}
            <span>{formatRelative(prompt.createdAt)}</span>
          </div>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug">
            <Link to={`/p/${prompt.id}`} className="hover:text-accent-ink">
              {prompt.title}
            </Link>
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <Avatar
              template={prompt.author.avatarTemplate}
              username={prompt.author.username}
              size={16}
            />
            <span>{prompt.author.username}</span>
            <span>· TL{prompt.author.trustLevel}</span>
            <span>· 通过 {prompt.history.approved} · 驳回 {prompt.history.rejected}</span>
          </div>
        </div>
      </header>

      <div className="relative border-t border-border px-4 py-3">
        <div ref={bodyRef} className={expanded ? "" : "max-h-56 overflow-hidden"}>
          <Markdown>{prompt.body}</Markdown>
          <OutputRequirements
            kind={prompt.kind}
            allowSearch={prompt.allowSearch}
            allowLibraries={prompt.allowLibraries}
            className="mt-3"
          />
        </div>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-surface to-transparent" />
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        {overflowing || expanded ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              strokeWidth={1.75}
            />
            {expanded ? "收起" : "展开全文"}
          </Button>
        ) : (
          <span />
        )}
        <ModerationActions kind="prompt" id={prompt.id} status="pending" />
      </footer>
    </article>
  );
}
