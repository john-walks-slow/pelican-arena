import { Markdown } from "~/components/markdown";
import { PagePreview } from "~/components/page-preview";
import { PreviewFrame } from "~/components/preview-frame";
import type { PromptKind } from "~/lib/kinds";
import { previewUrl, thumbnailUrl } from "~/lib/sandbox";
import { cn } from "~/lib/utils";

function SvgPreview({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <PreviewFrame
      title={alt}
      posterSrc={src}
      posterClassName="object-contain p-6"
      className={cn("aspect-[16/10] border-b border-rule bg-surface", className)}
    />
  );
}

/** A gallery-sized view of one work: live page, Markdown excerpt, or SVG. */
export function SubmissionPreview({
  kind,
  submissionId,
  origin,
  grant,
  title,
  excerpt,
  className,
}: {
  kind: PromptKind;
  submissionId: string;
  origin: string;
  grant?: string | null;
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
      <SvgPreview
        src={previewUrl(origin, submissionId, kind, grant)}
        alt={title}
        className={className}
      />
    );
  }

  return (
    <PagePreview
      src={previewUrl(origin, submissionId, kind, grant)}
      thumbnailSrc={thumbnailUrl(origin, submissionId, grant)}
      title={title}
      className={className}
    />
  );
}
