"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped inputs: barely-bordered, no surface fill, focus is the only
// loud state. Matches the Button size scale.

const BASE =
  "flex w-full rounded-md border border-border bg-transparent text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(BASE, "h-8 px-2.5", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      BASE,
      "px-2.5 py-2 min-h-[80px] resize-y leading-relaxed",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(BASE, "h-8 px-2", className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
