"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

// Entity choice for mention picker — same shape used across the app.
export interface EntityChoice {
  id: string;
  label: string;
  sub?: string;
  kind:
    | "person"
    | "customer"
    | "objective"
    | "business-unit"
    | "document";
}

const KIND_LABELS: Record<EntityChoice["kind"], string> = {
  person: "Person",
  customer: "Customer",
  objective: "Objective",
  "business-unit": "BU",
  document: "Doc",
};

// Each mention kind routes to its detail page. Used by the renderer to
// turn a chip into a clickable anchor.
export function hrefForEntity(kind: EntityChoice["kind"], id: string): string {
  switch (kind) {
    case "person":
      return `/people/${id}`;
    case "customer":
      return `/customers/${id}`;
    case "objective":
      return `/objectives/${id}`;
    case "business-unit":
      return `/business-units/${id}`;
    case "document":
      return `/documents/${id}`;
  }
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: EntityChoice[];
  command: (props: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<MentionListRef, Props>(function MentionList(
  { items, command },
  ref,
) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  function pick(index: number) {
    const item = items[index];
    if (!item) return;
    command({ id: item.id, label: item.label });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(selected);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="min-w-[260px] rounded-md border border-border bg-background shadow-md py-1">
        <div className="px-3 py-2 text-[12px] text-muted-foreground">
          No matches
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[280px] max-w-[400px] rounded-md border border-border bg-background shadow-md py-1">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Mention
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onMouseEnter={() => setSelected(i)}
              onClick={() => pick(i)}
              className={
                "w-full text-left px-3 py-1.5 text-[13px] flex items-center justify-between gap-3 " +
                (i === selected
                  ? "bg-accent text-foreground"
                  : "text-foreground/90 hover:bg-accent/60")
              }
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{item.label}</div>
                {item.sub && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {item.sub}
                  </div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {KIND_LABELS[item.kind]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
