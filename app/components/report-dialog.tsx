import { Flag, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
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
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/toaster";
import {
  REPORT_NOTE_LIMIT,
  REPORT_REASONS,
  ROUTING_REPORT_TIP,
  type ReportReason,
} from "~/lib/moderation";

type Result = { ok: true } | { error: string };

/** Reporting control for one answer; hidden entirely for its author. */
export function ReportDialog({
  submissionId,
  reported,
  disabledReason,
}: {
  submissionId: string;
  reported: boolean;
  disabledReason?: string;
}) {
  const fetcher = useFetcher<Result>();
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("metadata");
  const [note, setNote] = useState("");

  const busy = fetcher.state !== "idle";
  const handled = useRef<Result | null>(null);

  useEffect(() => {
    const result = fetcher.data;
    if (!result || handled.current === result) return;
    handled.current = result;
    if ("ok" in result) {
      toast.success("已收到反馈，感谢维护社区准则");
      setOpen(false);
      setNote("");
      revalidator.revalidate();
    } else {
      toast.error(result.error);
    }
  }, [fetcher.data, revalidator]);

  if (reported) {
    return (
      <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-muted">
        已收到反馈，管理团队正在复核。
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        onClick={() => setOpen(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted transition-colors hover:text-negative disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted"
      >
        <Flag className="size-3.5" strokeWidth={1.75} />
        举报此作品
      </button>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>举报作品</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              选择最符合的一项。你的反馈有助于维护评测的真实与安全。
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 px-5 py-4">
            <fieldset className="space-y-1.5">
              <legend className="mb-1.5 text-xs font-medium text-muted">选择违规类别</legend>
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-0.5">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-control border px-3 py-2 text-sm transition-colors ${
                      reason === r.id ? "border-ink/30 bg-raised" : "border-border hover:bg-raised/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="mt-0.5 accent-ink"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-xs text-muted">{r.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {reason === "metadata" && (
              <div className="flex items-start gap-2 rounded-control bg-raised/60 p-2.5 text-xs text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted" />
                <p className="leading-relaxed">{ROUTING_REPORT_TIP}</p>
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                补充说明
                {reason !== "other" && <span className="ml-1 text-muted/70">（选填）</span>}
              </span>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={REPORT_NOTE_LIMIT}
                rows={3}
                placeholder={
                  reason === "metadata"
                    ? "请说明判断实际模型的线索或证据（如响应特征、日志疑点等）"
                    : reason === "other"
                      ? "请详细写明违规情况"
                      : "补充有助于管理团队复核的细节线索"
                }
              />
            </label>
          </DialogBody>
          <DialogFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || (reason === "other" && !note.trim())}
              onClick={() =>
                fetcher.submit(
                  { reason, note: note.trim() },
                  { method: "post", action: `/s/${submissionId}/report` },
                )
              }
            >
              {busy ? "提交中…" : "提交举报"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
