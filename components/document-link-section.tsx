"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Tag-style multi-select used by document forms (research, PRD, etc.) to
// link entities like people, customers, objectives. Mirrors the original
// helper that lived inside research-form.

interface Props {
  title: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function DocumentLinkSection({
  title,
  items,
  selected,
  onToggle,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayItems = showAll
    ? items
    : items.filter((i) => selected.includes(i.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {title} ({selected.length})
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Hide list" : `Browse all (${items.length})`}
        </button>
      </div>
      {displayItems.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">None linked.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayItems.map((item) => {
            const sel = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  sel
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                title={item.sub}
              >
                {item.label}
                {sel && <X className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
