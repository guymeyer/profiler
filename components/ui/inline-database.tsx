"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Notion-shaped database view. Compact table that flows inline as part of
// a document. Minimal borders (just a header underline), hover rows,
// click-to-detail navigation, optional sortable columns.
//
// Designed to replace card grids on list pages and embedded "linked
// artifact" sections inside detail pages. One component, many uses.

export type ColumnKind = "text" | "muted" | "badge" | "date" | "number";

export interface InlineDatabaseColumn<T> {
  key: string;
  label: string;
  // Renders the cell content. Return a string or a React node.
  render: (row: T) => React.ReactNode;
  // For sorting. Return a string or number. If absent, column is not sortable.
  sortValue?: (row: T) => string | number;
  // Visual emphasis hint. "text" is the default body weight; "muted" is
  // the captions-and-metadata weight; "badge" / "date" / "number" align
  // and style accordingly.
  kind?: ColumnKind;
  // Column width hint (Tailwind class). Default is auto.
  width?: string;
  // Alignment override. Defaults to "left" except for number (right).
  align?: "left" | "right" | "center";
}

interface Props<T extends { id: string }> {
  rows: T[];
  columns: InlineDatabaseColumn<T>[];
  // Href to navigate to when a row is clicked. If absent, rows aren't
  // clickable.
  rowHref?: (row: T) => string;
  // Empty-state line (no chrome — just muted text).
  emptyLabel?: string;
  // Initial sort key + direction. Optional.
  initialSort?: { key: string; dir: "asc" | "desc" };
  // Optional row limit + "show more" affordance.
  limit?: number;
  className?: string;
}

export function InlineDatabase<T extends { id: string }>({
  rows,
  columns,
  rowHref,
  emptyLabel = "No items.",
  initialSort,
  limit,
  className,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    initialSort ?? null,
  );
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const out = [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sort.dir === "asc" ? av - bv : bv - av;
      }
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return out;
  }, [rows, sort, columns]);

  const visible =
    limit && !showAll && sorted.length > limit
      ? sorted.slice(0, limit)
      : sorted;

  function toggleSort(col: InlineDatabaseColumn<T>) {
    if (!col.sortValue) return;
    setSort((cur) => {
      if (!cur || cur.key !== col.key) {
        return { key: col.key, dir: "asc" };
      }
      if (cur.dir === "asc") return { key: col.key, dir: "desc" };
      return null;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-[13px] text-muted-foreground italic">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => {
                const sortable = !!col.sortValue;
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 first:pl-0 last:pr-0",
                      col.width,
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.kind === "number" &&
                        col.align === undefined &&
                        "text-right",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.label}
                        {isSorted &&
                          (sort.dir === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = rowHref?.(row);
              const content = columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "py-2 px-2 first:pl-0 last:pr-0 align-top",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.kind === "number" &&
                      col.align === undefined &&
                      "text-right tabular-nums",
                    col.kind === "muted" && "text-muted-foreground",
                    col.kind === "date" &&
                      "text-muted-foreground tabular-nums whitespace-nowrap",
                  )}
                >
                  {col.render(row)}
                </td>
              ));
              if (href) {
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 hover:bg-accent/40 transition-colors group cursor-pointer"
                    onClick={(e) => {
                      // Don't intercept clicks on inner links / buttons.
                      const target = e.target as HTMLElement;
                      if (target.closest("a,button")) return;
                      window.location.href = href;
                    }}
                  >
                    {content}
                  </tr>
                );
              }
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/60 hover:bg-accent/40 transition-colors"
                >
                  {content}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limit && !showAll && sorted.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-[12px] text-muted-foreground hover:text-foreground"
        >
          Show {sorted.length - limit} more
        </button>
      )}
    </div>
  );
}

// ── Helpers commonly used in column renders ────────────────────────────────

export function DbDate({ iso }: { iso: string | undefined }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span>
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
    </span>
  );
}

export function DbBadge({
  label,
  tone = "subtle",
}: {
  label: string;
  tone?: "subtle" | "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function DbLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-foreground hover:text-primary transition-colors"
    >
      {children}
    </Link>
  );
}
