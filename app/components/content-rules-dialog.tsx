import * as React from "react";
import { Flag } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "~/components/ui/toaster";
import {
  CONTENT_RULES_ITEMS,
  CONTENT_RULES_REQUIRED_SECONDS,
  CONTENT_RULES_SUBTITLE,
  CONTENT_RULES_TITLE,
} from "~/lib/content-rules";

export interface ContentRulesDialogProps {
  open: boolean;
  mode?: "mandatory" | "view";
  onAccepted?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function ContentRulesDialog({
  open,
  mode = "mandatory",
  onAccepted,
  onOpenChange,
}: ContentRulesDialogProps) {
  const isMandatory = mode === "mandatory";
  const [countdown, setCountdown] = React.useState(
    isMandatory ? CONTENT_RULES_REQUIRED_SECONDS : 0,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCountdown(isMandatory ? CONTENT_RULES_REQUIRED_SECONDS : 0);
      setIsSubmitting(false);
      return;
    }

    if (!isMandatory) {
      setCountdown(0);
      return;
    }

    setCountdown(CONTENT_RULES_REQUIRED_SECONDS);
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open, isMandatory]);

  const handleAction = async () => {
    if (countdown > 0 || isSubmitting) return;

    if (!isMandatory) {
      onOpenChange?.(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/rules/accept", { method: "POST" });
      if (!res.ok) {
        throw new Error("请求失败");
      }
      onAccepted?.();
      onOpenChange?.(false);
    } catch {
      toast.error("网络异常，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isMandatory) return;
        onOpenChange?.(next);
      }}
    >
      <DialogContent
        hideClose={isMandatory}
        className="sm:max-w-[520px]"
        onPointerDownOutside={(e) => {
          if (isMandatory) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isMandatory) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-rule pb-3">
          <DialogTitle className="text-base font-semibold text-ink">
            {CONTENT_RULES_TITLE}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {CONTENT_RULES_SUBTITLE}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3 px-5 py-4">
          <p className="text-xs text-muted leading-relaxed">
            {CONTENT_RULES_SUBTITLE}
          </p>

          <div className="divide-y divide-rule rounded-card border border-rule bg-raised/35 overflow-hidden">
            {CONTENT_RULES_ITEMS.map((item, index) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-raised/60"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent mt-0.5">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <span className="text-xs font-semibold text-ink tracking-tight">
                    {item.title}
                  </span>
                  <span className="mx-1.5 text-xs text-muted/60">·</span>
                  <span className="text-xs text-muted leading-relaxed">
                    {item.description}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 px-0.5 text-xs text-muted">
            <Flag className="size-3.5 text-negative fill-negative/20 shrink-0" strokeWidth={1.85} />
            <span>发现违规题目或作答，可点击页面下方的举报按钮进行反馈。</span>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-rule pt-3 justify-end">
          <Button
            type="button"
            variant="primary"
            disabled={countdown > 0 || isSubmitting}
            onClick={handleAction}
            className="w-full sm:w-auto min-w-[120px]"
          >
            {countdown > 0
              ? `我知道了 (${countdown}s)`
              : isSubmitting
                ? "提交中..."
                : "我知道了"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
