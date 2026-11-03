import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Segmented } from "~/components/ui/segmented";
import { toast } from "~/components/ui/toaster";
import { THUMBNAIL_VERSION } from "~/lib/sandbox";
import { SHARE_FORMATS, shareSnippet, type ShareFormat } from "~/lib/share";

interface ShareDialogProps {
  path: string;
  title: string;
  appOrigin: string;
}

const CARD_WIDTH = 600;
const CARD_HEIGHT = 400;

/** Previews the exact asset the snippet points at, so the dialog cannot drift from what gets posted. */
function CardPreview({ src, alt }: { src: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const url = attempt === 0 ? src : `${src}?retry=${attempt}`;

  return (
    <div
      className="relative aspect-[600/400] w-full overflow-hidden rounded-[14px] bg-white"
      aria-busy={state === "loading"}
    >
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] text-xs text-[#9ca3af]">
          正在生成分享卡片…
        </div>
      )}
      {state === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#fafafa]">
          <button
            type="button"
            className="text-xs text-[#6b7280] underline underline-offset-2 hover:text-[#111827]"
            onClick={() => {
              setState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            卡片生成失败，重试
          </button>
        </div>
      ) : (
        <img
          key={url}
          src={url}
          alt={alt}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={`size-full object-contain transition-opacity duration-150 ${
            state === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

export function ShareDialog({ path, title, appOrigin }: ShareDialogProps) {
  // 默认选中可直接在社区渲染成卡的代码
  const [format, setFormat] = useState<ShareFormat>("card");
  const [copied, setCopied] = useState(false);

  // A preview proxy may rewrite the host, so trust the address the reader is
  // actually on once we are in the browser.
  const [origin, setOrigin] = useState(appOrigin.replace(/\/+$/, ""));
  useEffect(() => setOrigin(window.location.origin), []);

  const pageUrl = `${origin}${path}`;
  // Same version as the poster: a regenerated thumbnail must also refresh cards.
  const cardUrl = `${pageUrl}/card.svg?v=${THUMBNAIL_VERSION}`;
  const snippet = shareSnippet({ pageUrl, cardUrl, title }, format);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && setCopied(false)}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="header-collapse-fade gap-1.5 max-sm:px-2.5"
          aria-label="分享"
        >
          <Share2 className="size-4 text-muted" strokeWidth={1.75} />
          <span className="hidden sm:inline">分享</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>分享到社区</DialogTitle>
          <DialogDescription className="sr-only">复制卡片代码直接发帖</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 px-5 py-4">
          <CardPreview src={cardUrl} alt={title} />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs text-muted">分享格式</span>
            <Segmented
              label="分享格式"
              value={format}
              options={SHARE_FORMATS}
              onChange={setFormat}
            />
          </div>

          <textarea
            readOnly
            value={snippet}
            rows={format === "card" ? 3 : 2}
            onFocus={(e) => e.currentTarget.select()}
            className="num block w-full resize-none rounded-control border border-control bg-raised px-3 py-2 text-xs leading-relaxed break-all text-ink outline-none focus:border-accent font-mono"
          />
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={copy}
            aria-live="polite"
            className="min-w-28 gap-1.5"
          >
            {copied ? (
              <Check className="size-4" strokeWidth={2} />
            ) : (
              <Copy className="size-4" strokeWidth={1.75} />
            )}
            {copied ? "已复制" : "复制代码"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
