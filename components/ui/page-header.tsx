import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped page header. Title prominent at the top, a single inline
// muted line of metadata below, no surrounding card. Optional `actions`
// area floats right and stays restrained.
//
// Designed to be the FIRST element on a page, replacing the old
// "<header><div className='flex'><Card>…" patterns.

interface Props {
  // Optional small uppercase label above the title ("Research", "PRD",
  // "Person profile"). Used sparingly — Notion documents usually just have
  // a title.
  eyebrow?: string;
  title: React.ReactNode;
  // One-line metadata, e.g. "Updated 3 days ago · 4 sources · drafted by
  // Bill". Use ` · ` between items. Caller passes plain text or a React
  // fragment with inline Link/Badge elements.
  meta?: React.ReactNode;
  // Right-side actions (buttons, dropdowns). Keep to 1-3 items.
  actions?: React.ReactNode;
  // Body content immediately under the meta line (e.g. summary lede).
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  children,
  className,
}: Props) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight leading-tight text-foreground">
            {title}
          </h1>
          {meta && (
            <div className="mt-2 text-sm text-muted-foreground leading-normal">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
