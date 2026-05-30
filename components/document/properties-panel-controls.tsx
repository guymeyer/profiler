"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared building blocks for kind-specific Properties panels. The panels
// themselves live in properties-panels.tsx; the controls here let each
// panel stay short and consistent in look-and-feel.

export function PanelContainer({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-6 rounded-md border border-border bg-muted/40 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]",
        disabled && "opacity-60",
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

export function LinkedChips({
  label,
  items,
  selected,
  onChange,
  disabled,
  full,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  full?: boolean;
}) {
  function toggle(id: string) {
    if (disabled) return;
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }
  return (
    <Field label={label} full={full}>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 ? (
          <span className="text-muted-foreground italic">None on file yet.</span>
        ) : (
          items.map((it) => {
            const on = selected.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                disabled={disabled}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] border transition-colors",
                  on
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {it.label}
              </button>
            );
          })
        )}
      </div>
    </Field>
  );
}
