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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{message}</DialogDescription>
        </DialogHeader>
        <DialogBody className="px-5 py-4 text-sm text-muted">{message}</DialogBody>
        <DialogFooter className="justify-end">
          <Button type="button" variant="primary" onClick={onClose}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
