import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:cursor-not-allowed select-none",
  {
    variants: {
      variant: {
        primary:
          "border border-black/15 bg-primary font-semibold text-primary-ink shadow-btn-primary hover:bg-primary-hover hover:shadow-btn-primary-hover active:scale-[0.985] active:translate-y-[0.5px] active:shadow-none disabled:border-transparent disabled:bg-raised disabled:text-muted disabled:shadow-none dark:border-white/20",
        default:
          "border border-black/10 bg-primary font-medium text-primary-ink shadow-xs hover:bg-primary-hover active:scale-[0.985] active:translate-y-[0.5px] disabled:border-transparent disabled:bg-raised disabled:text-muted disabled:shadow-none dark:border-white/10",
        destructive:
          "border border-negative-solid/20 bg-negative-solid font-medium text-white shadow-btn-primary hover:bg-negative-solid/90 active:scale-[0.985] active:translate-y-[0.5px] disabled:border-transparent disabled:bg-raised disabled:text-muted disabled:shadow-none",
        outline:
          "border border-control bg-surface font-medium text-ink shadow-btn-control hover:border-ink/30 hover:bg-raised active:scale-[0.985] active:translate-y-[0.5px] disabled:border-border disabled:bg-surface disabled:text-muted disabled:shadow-none",
        secondary:
          "border border-transparent bg-raised font-medium text-ink shadow-2xs hover:bg-active active:scale-[0.985] active:translate-y-[0.5px] disabled:bg-surface disabled:text-muted disabled:shadow-none",
        ghost: "font-medium text-muted hover:bg-raised hover:text-ink disabled:text-muted/60",
        link: "h-auto p-0 font-medium text-accent underline-offset-4 hover:underline disabled:text-muted",
        linuxdo:
          "border border-black/20 bg-[#1c1c1e] font-medium text-white shadow-xs hover:bg-black active:scale-[0.985] active:translate-y-[0.5px] disabled:border-transparent disabled:bg-raised disabled:text-muted disabled:shadow-none dark:border-transparent dark:bg-[#1c1c1e] dark:text-white dark:hover:bg-[#26262a]",
      },
      size: {
        default: "h-8 px-3.5 text-xs sm:text-sm",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
