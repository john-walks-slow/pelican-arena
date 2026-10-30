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
import { ShareCardPreview, type ShareCardData } from "~/components/share-card-preview";

interface ShareDialogProps {
  path: string;
  title: string;
  appOrigin: string;
  cardData: ShareCardData;
}

export function ShareDialog({ path, title, appOrigin, cardData }: ShareDialogProps) {
  // 默认直接选中与 Linux DO 论坛 100% 完美兼容的专属卡片代码
  const [format, setFormat] = useState<ShareFormat>("forum");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);

  const origin = appOrigin.replace(/\/+$/, "");
  const pageUrl = `${origin}${path}`;
  const cardUrl = `${pageUrl}/card.svg`;
  const snippet = shareSnippet({ pageUrl, cardUrl, title }, format);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("已复制到剪贴板，可直接发到 Linux DO");
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>分享到论坛</DialogTitle>
          <DialogDescription className="sr-only">复制专属卡片代码直接发帖</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 px-5 py-4">
          {/* 实时卡片预览 */}
          <ShareCardPreview data={cardData} />

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
              {copied ? "已复制" : "复制代码"}
            </Button>
          </div>
          <textarea
            readOnly
            value={snippet}
            rows={format === "forum" || format === "html" ? 3 : 2}
            onFocus={(e) => e.currentTarget.select()}
            className="num block w-full resize-none rounded-control border border-control bg-raised px-3 py-2 text-xs leading-relaxed break-all text-ink outline-none focus:border-accent font-mono"
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
