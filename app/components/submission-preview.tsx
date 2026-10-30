import { useEffect, useRef, useState } from "react";
import { Markdown } from "~/components/markdown";
import { PagePreview } from "~/components/page-preview";
import { PreviewSkeleton } from "~/components/preview-skeleton";
import type { PromptKind } from "~/lib/kinds";
import { previewUrl, submissionUrl } from "~/lib/sandbox";
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
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div
      className={cn(
        "relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-rule bg-surface p-6",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 ease-out",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <PreviewSkeleton />
      </div>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "max-h-full max-w-full object-contain transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

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
      <SvgPreview
        src={previewUrl(origin, submissionId, kind)}
        alt={title}
        className={className}
      />
    );
  }

  return (
    <PagePreview
      src={submissionUrl(origin, submissionId, kind)}
      title={title}
      className={className}
    />
  );
}
