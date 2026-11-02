import { GateDialog } from "~/components/gate-dialog";

export function SubmissionErrorDialog({
  open,
  onClose,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
}) {
  return (
    <GateDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      reason="trust_level"
      title={title}
      message={message}
    />
  );
}
