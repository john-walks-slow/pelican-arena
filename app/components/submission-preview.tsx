import { Markdown } from "~/components/markdown";
import { PagePreview } from "~/components/page-preview";
import type { PromptKind } from "~/lib/kinds";
import { submissionUrl } from "~/lib/sandbox";
import { cn } from "~/lib/utils";

/** A gallery-sized view of one work: live page, Markdown excerpt, or SVG. */
export function SubmissionPreview({
  kind,
  submissionId,
  origin,
  title,
  excerpt,
  className,
}: {
  kind: PromptKind;
  submissionId: string;
  origin: string;
  title: string;
  excerpt?: string | null;
  className?: string;
}) {
  if (kind === "markdown") {
    return (
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden border-b border-rule bg-surface px-5 py-4",
          className,
        )}
      >
        <Markdown className="markdown-card pointer-events-none">
          {excerpt?.trim() || "（空文档）"}
        </Markdown>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface" />
      </div>
    );
  }

  if (kind === "svg") {
    return (
      <div
        className={cn(
          "flex aspect-[16/10] items-center justify-center border-b border-rule bg-surface p-6",
          className,
        )}
      >
        <img
          src={submissionUrl(origin, submissionId, kind)}
          alt={title}
          loading="lazy"
          decoding="async"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return <PagePreview src={submissionUrl(origin, submissionId, kind)} title={title} />;
}
