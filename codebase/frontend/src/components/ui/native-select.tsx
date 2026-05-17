"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";
