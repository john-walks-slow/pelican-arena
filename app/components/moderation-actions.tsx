import { Loader2 } from "lucide-react";
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
  availablePromptActions,
  availableSubmissionActions,
  MODERATION_NOTE_LIMIT,
  PROMPT_TRANSITIONS,
  REJECT_REASONS,
  type PromptAction,
  type PromptStatus,
  type SubmissionAction,
  type SubmissionStatus,
} from "~/lib/moderation";

type Kind = "prompt" | "submission";
type Action = PromptAction | SubmissionAction;

type Result = { ok: true; message: string } | { error: string };

const ACTION_LABELS: Record<Action, string> = {
  approve: "通过",
  reject: "驳回",
  remove: "下架",
  restore: "恢复",
  keep: "保留",
};

const ACTION_COPY: Record<Kind, Record<string, string>> = {
  prompt: {
    approve: "通过后题目立即公开并开放作答。",
    reject: "作者会看到理由，修改后可以重新提交。",
    remove: "题目会从站内和答案站一起下线，已有答案保留。",
    restore: "题目恢复到公开状态，答案同时恢复。",
  },
  submission: {
    keep: "举报全部驳回；若之前被自动隐藏，会恢复公开。",
    remove: "答案会从站内和答案站一起下线，作者会看到理由。",
    restore: "答案恢复到公开状态。",
  },
};

function NoteField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
        {!required && <span className="ml-1 text-muted/70">可选</span>}
      </span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MODERATION_NOTE_LIMIT}
        rows={3}
      />
    </label>
  );
}

/**
 * Admin decisions for one prompt or answer. Posts to `/admin` and refreshes the
 * current page, so the same control works on detail pages and in the queue.
 */
export function ModerationActions({
  kind,
  id,
  status,
  size = "sm",
  className,
  excludeActions,
}: {
  kind: Kind;
  id: string;
  status: PromptStatus | SubmissionStatus;
  size?: "sm" | "default";
  className?: string;
  excludeActions?: Action[];
}) {
  const fetcher = useFetcher<Result>();
  const revalidator = useRevalidator();
  const [pending, setPending] = useState<Action | null>(null);
  const handled = useRef<Result | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string>(REJECT_REASONS[0].id);

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    const result = fetcher.data;
    if (!result || handled.current === result) return;
    handled.current = result;
    if ("ok" in result) {
      toast.success(result.message);
      setPending(null);
      revalidator.revalidate();
    } else {
      toast.error(result.error);
    }
  }, [fetcher.data, revalidator]);

  const rawActions: Action[] =
    kind === "prompt"
      ? availablePromptActions(status as PromptStatus)
      : availableSubmissionActions(status as SubmissionStatus);

  const actions = excludeActions
    ? rawActions.filter((a) => !excludeActions.includes(a))
    : rawActions;

  if (actions.length === 0) return null;

  const needsDialog = (action: Action) =>
    PROMPT_TRANSITIONS[action as PromptAction]?.noteRequired ||
    (kind === "submission" && action === "remove");

  const submit = (action: Action, withNote: string | null) => {
    const body = new URLSearchParams({ intent: kind, action, id });
    if (withNote?.trim()) body.set("note", withNote.trim());
    if (kind === "prompt" && action === "reject") body.set("reason", reason);
    fetcher.submit(body, { method: "post", action: "/admin" });
  };

  const start = (action: Action) => {
    if (!needsDialog(action)) {
      submit(action, null);
      return;
    }
    setNote("");
    setReason(REJECT_REASONS[0].id);
    setPending(action);
  };

  const dialogOpen = pending !== null;
  const dialogAction = pending;

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            size={size}
            variant={action === "remove" || action === "reject" ? "destructive" : "outline"}
            disabled={busy}
            onClick={() => start(action)}
          >
            {action === "keep" ? "保留答案" : ACTION_LABELS[action]}
          </Button>
        ))}
        {busy && <Loader2 className="size-3.5 animate-spin text-muted" strokeWidth={2} />}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {dialogAction ? ACTION_LABELS[dialogAction] : ""}
              {kind === "prompt" ? "题目" : "答案"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {dialogAction ? ACTION_COPY[kind][dialogAction] : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 px-5 py-4">
            {dialogAction && (
              <p className="text-sm leading-relaxed text-muted">
                {ACTION_COPY[kind][dialogAction]}
              </p>
            )}

            {kind === "prompt" && dialogAction === "reject" && (
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-xs font-medium text-muted">理由</legend>
                {REJECT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-control border px-3 py-2 text-sm transition-colors ${
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
                    <span>{r.label}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <NoteField
              label={kind === "prompt" && dialogAction === "reject" && reason !== "other" ? "补充说明" : "理由"}
              value={note}
              onChange={setNote}
              required={dialogAction === "remove" || (dialogAction === "reject" && reason === "other")}
              placeholder={
                dialogAction === "remove"
                  ? "写清下架原因，作者会看到"
                  : "补充说明（可选）"
              }
            />
          </DialogBody>
          <DialogFooter className="justify-end">
            <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>
              取消
            </Button>
            <Button
              type="button"
              variant={dialogAction === "remove" || dialogAction === "reject" ? "destructive" : "primary"}
              disabled={
                busy ||
                (dialogAction === "remove" && !note.trim()) ||
                (dialogAction === "reject" && reason === "other" && !note.trim())
              }
              onClick={() => {
                if (!dialogAction) return;
                const text =
                  kind === "prompt" && dialogAction === "reject"
                    ? [REJECT_REASONS.find((r) => r.id === reason)?.label, note.trim()]
                        .filter(Boolean)
                        .join("：")
                    : note;
                submit(dialogAction, text);
              }}
            >
              {busy ? "处理中…" : `确认${dialogAction ? ACTION_LABELS[dialogAction] : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
