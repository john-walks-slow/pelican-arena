import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      offset={20}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-card !border !border-border !bg-surface !text-ink !text-[13px] !shadow-lg",
          description: "!text-muted",
          actionButton: "!bg-primary !text-primary-ink",
          cancelButton: "!bg-raised !text-ink",
          icon: "!text-accent",
        },
      }}
      {...props}
    />
  );
};

export { toast };
