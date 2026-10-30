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
import { SHARE_FORMATS, shareSnippet, type ShareFormat } from "~/lib/share";

interface ShareDialogProps {
  /** Site-relative page path, such as `/s/abc`. The card lives at `${path}/card.svg`. */
  path: string;
  title: string;
  appOrigin: string;
}

export function ShareDialog({ path, title, appOrigin }: ShareDialogProps) {
  const [format, setFormat] = useState<ShareFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);

  const origin = appOrigin.replace(/\/+$/, "");
  const pageUrl = `${origin}${path}`;
  const snippet = shareSnippet({ pageUrl, cardUrl: `${pageUrl}/card.svg`, title }, format);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("已复制");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  const nativeShare = () => navigator.share({ title, url: pageUrl }).catch(() => {});

  return (
    <Dialog onOpenChange={(open) => open && setCopied(false)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 max-sm:px-2.5" aria-label="分享">
          <Share2 className="size-4 text-muted" strokeWidth={1.75} />
          <span className="hidden sm:inline">分享</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>分享</DialogTitle>
          <DialogDescription className="sr-only">复制分享卡片或链接</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 px-5 py-4">
          <img
            src={`${path}/card.svg`}
            alt={title}
            width={600}
            height={315}
            className="aspect-[600/315] w-full rounded-card border border-border"
          />
          <div className="flex items-center justify-between gap-3">
            <Segmented label="分享格式" value={format} options={SHARE_FORMATS} onChange={setFormat} />
            <Button
              type="button"
              variant={copied ? "outline" : "primary"}
              onClick={copy}
              aria-live="polite"
              className={`gap-1.5 ${copied ? "border-positive/40 text-positive" : ""}`}
            >
              {copied ? (
                <Check className="size-4" strokeWidth={2} />
              ) : (
                <Copy className="size-4" strokeWidth={1.75} />
              )}
              {copied ? "已复制" : "复制"}
            </Button>
          </div>
          <textarea
            readOnly
            value={snippet}
            rows={format === "link" ? 1 : 3}
            onFocus={(e) => e.currentTarget.select()}
            className="num block w-full resize-none rounded-control border border-control bg-raised px-3 py-2 text-xs leading-relaxed break-all text-ink outline-none focus:border-accent"
          />
        </DialogBody>
        {canNativeShare && (
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" onClick={nativeShare} className="gap-1.5">
              <Share2 className="size-4 text-muted" strokeWidth={1.75} />
              系统分享
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
