import * as React from "react";
import { cn } from "~/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer relative animate-pulse rounded-control", className)}
      {...props}
    />
  );
}
