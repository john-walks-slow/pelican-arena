import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-black",
        primary: "bg-ink text-white hover:bg-black",
        destructive: "bg-negative text-white hover:bg-[#a61c22]",
        outline:
          "border border-control bg-surface text-ink hover:border-ink/30 hover:bg-raised",
        secondary: "bg-raised text-ink hover:bg-active",
        ghost: "text-muted hover:bg-raised hover:text-ink",
        link: "h-auto p-0 text-accent underline-offset-4 hover:underline",
        linuxdo: "bg-[#1c1c1e] text-white hover:bg-black",
      },
      size: {
        default: "h-8 px-3 text-sm",
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
