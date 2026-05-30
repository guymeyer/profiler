"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped buttons. Restrained chrome: no shadows, subtle borders,
// minimal weight. Primary stays confident (dark fill) — it's the only
// element that's permitted to carry presence; everything else is quiet.

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Primary: near-black fill. The single confident action on a page.
  primary: "bg-foreground text-background hover:bg-foreground/90",
  // Secondary: barely-bordered button on the page background.
  secondary:
    "bg-transparent text-foreground border border-border hover:bg-accent",
  ghost: "text-foreground hover:bg-accent",
  outline:
    "border border-border text-foreground hover:bg-accent bg-transparent",
  // Danger: muted destructive — colored text on subtle background, not
  // a saturated red block.
  danger:
    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-[13px] gap-1.5",
  lg: "h-10 px-4 text-sm gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
