import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped section. Just a heading with deliberate spacing — no
// container, no border, no icon. Hierarchy comes from the heading size
// (h2 by default, override with `as`).
//
// Use this for "Overview", "Insights", "Linked artifacts", etc. — any
// chunk of content that would have lived inside its own <Card> before.

interface Props {
  // The heading text. Optional — pass null for "spacing only" sections.
  title?: React.ReactNode;
  // Optional muted subtitle / count, inline next to the title.
  subtitle?: React.ReactNode;
  // Optional right-side affordance (a small action, "view all" link, etc).
  trailing?: React.ReactNode;
  // h2 by default. Use h3 for nested sections.
  as?: "h2" | "h3";
  children?: React.ReactNode;
  className?: string;
  // First section in a document doesn't need a top border above it.
  divider?: boolean;
}

export function Section({
  title,
  subtitle,
  trailing,
  as = "h2",
  children,
  className,
  divider = false,
}: Props) {
  const Heading = as;
  const headingClass =
    as === "h2"
      ? "text-[17px] font-semibold tracking-tight"
      : "text-[14px] font-semibold tracking-tight";
  return (
    <section
      className={cn(
        "py-6",
        divider && "border-t border-border",
        className,
      )}
    >
      {title && (
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <Heading className={headingClass}>{title}</Heading>
            {subtitle && (
              <span className="text-[12px] text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
          {trailing && <div className="flex-shrink-0">{trailing}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
