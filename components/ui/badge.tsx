import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped badge: by default it's just muted inline text with no chrome.
// Tone-driven backgrounds are reserved for the rare case where color
// genuinely aids comprehension (stance, status, severity). Most callers
// should just pass tone="subtle" and trust the muted text.

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "subtle";

const tones: Record<Tone, string> = {
  subtle: "text-muted-foreground",
  neutral: "text-foreground/80",
  // Tone-colored badges keep a very faint background tint + colored text.
  // No borders — they read as inline labels, not buttons.
  primary: "bg-primary/[0.08] text-primary",
  success: "bg-success/[0.08] text-success",
  warning: "bg-warning/[0.08] text-warning",
  danger: "bg-danger/[0.08] text-danger",
};

export function Badge({
  tone = "subtle",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const colored =
    tone === "primary" ||
    tone === "success" ||
    tone === "warning" ||
    tone === "danger";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        colored
          ? "rounded px-1.5 py-0.5"
          : "rounded px-1 py-0",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
