"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Pencil, Save, X } from "lucide-react";

// Entity choice for @-autocomplete. Caller provides the full list; the
// editor handles searching, positioning, and insertion.
export interface EntityChoice {
  id: string;
  label: string;
  sub?: string;
  kind: "person" | "customer" | "objective" | "business-unit";
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  warnings?: string[];
  saveLabel?: string;
  className?: string;
  // Autocomplete corpus. When provided, typing `@` opens a searchable
  // picker that inserts entity ids at the cursor.
  entities?: EntityChoice[];
}

const KIND_LABELS: Record<EntityChoice["kind"], string> = {
  person: "Person",
  customer: "Customer",
  objective: "Objective",
  "business-unit": "BU",
};

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
  warnings,
  saveLabel = "Save",
  className,
  entities,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [ac, setAc] = useState<{
    open: boolean;
    query: string;
    triggerIndex: number; // index of '@' in value
    top: number;
    left: number;
    activeIndex: number;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!ac || !entities) return [];
    const q = ac.query.toLowerCase();
    const matches = entities.filter((e) => {
      if (!q) return true;
      return (
        e.label.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.sub?.toLowerCase().includes(q) ?? false)
      );
    });
    return matches.slice(0, 8);
  }, [ac, entities]);

  function detectTrigger(text: string, cursor: number) {
    if (!entities || entities.length === 0) return null;
    // Walk back from cursor looking for the most recent '@', stopping at
    // whitespace or newline. If found and the chars after it (up to cursor)
    // are all letters/digits/dash, we're in autocomplete mode.
    let i = cursor - 1;
    while (i >= 0) {
      const c = text[i];
      if (c === "@") {
        const query = text.slice(i + 1, cursor);
        if (/^[\w-]*$/.test(query)) {
          return { triggerIndex: i, query };
        }
        return null;
      }
      if (/\s/.test(c)) return null;
      // Allow normal identifier chars in the query
      if (!/[\w-]/.test(c)) return null;
      i--;
    }
    return null;
  }

  function updateAutocomplete(textarea: HTMLTextAreaElement) {
    const text = textarea.value;
    const cursor = textarea.selectionStart;
    const trigger = detectTrigger(text, cursor);
    if (!trigger) {
      setAc(null);
      return;
    }
    const { top, left } = caretCoords(textarea, trigger.triggerIndex);
    setAc({
      open: true,
      query: trigger.query,
      triggerIndex: trigger.triggerIndex,
      top,
      left,
      activeIndex: 0,
    });
  }

  function insertChoice(choice: EntityChoice) {
    if (!ac || !textareaRef.current) return;
    const ta = textareaRef.current;
    const before = value.slice(0, ac.triggerIndex);
    const afterCursor = ta.selectionStart;
    const after = value.slice(afterCursor);
    const insertion = choice.id;
    const next = before + insertion + after;
    onChange(next);
    setAc(null);
    // Restore cursor position after the inserted id
    const newCursor = before.length + insertion.length;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!ac?.open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAc((cur) =>
        cur ? { ...cur, activeIndex: (cur.activeIndex + 1) % filtered.length } : cur,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAc((cur) =>
        cur
          ? {
              ...cur,
              activeIndex:
                (cur.activeIndex - 1 + filtered.length) % filtered.length,
            }
          : cur,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertChoice(filtered[ac.activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAc(null);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div
          role="radiogroup"
          aria-label="Editor mode"
          className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5"
        >
          {(
            [
              { v: "edit", label: "Edit", icon: Pencil },
              { v: "preview", label: "Preview", icon: Eye },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = tab === opt.v;
            return (
              <button
                key={opt.v}
                role="radio"
                aria-checked={active}
                onClick={() => setTab(opt.v)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3 h-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-muted-foreground hover:text-danger"
            >
              Delete
            </button>
          )}
          {onCancel && (
            <Button variant="secondary" size="sm" onClick={onCancel}>
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/[0.06] p-3 space-y-1">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="text-xs text-foreground/80 flex items-start gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {tab === "edit" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              updateAutocomplete(e.currentTarget);
            }}
            onKeyDown={onTextareaKeyDown}
            onClick={(e) => updateAutocomplete(e.currentTarget)}
            onKeyUp={(e) => {
              // Update on arrow / home / end / etc.
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
              ) {
                updateAutocomplete(e.currentTarget);
              }
            }}
            onBlur={() => {
              // Delay so click on popover lands before close
              setTimeout(() => setAc(null), 100);
            }}
            spellCheck
            className="w-full min-h-[480px] rounded-md border border-border bg-background p-4 font-mono text-[13px] leading-relaxed resize-y"
          />
          {ac?.open && filtered.length > 0 && (
            <AutocompletePopover
              top={ac.top}
              left={ac.left}
              choices={filtered}
              activeIndex={ac.activeIndex}
              onSelect={(c) => insertChoice(c)}
              onHover={(i) =>
                setAc((cur) => (cur ? { ...cur, activeIndex: i } : cur))
              }
            />
          )}
        </div>
      ) : (
        <div className="prose-memo max-w-none rounded-md border border-border bg-surface/40 p-5 min-h-[480px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      )}

      {entities && entities.length > 0 && tab === "edit" && (
        <div className="text-[11px] text-muted-foreground">
          Type{" "}
          <code className="bg-muted px-1 rounded text-[10px]">@</code> in the
          editor to insert a person, customer, objective, or business unit id.
        </div>
      )}
    </div>
  );
}

function AutocompletePopover({
  top,
  left,
  choices,
  activeIndex,
  onSelect,
  onHover,
}: {
  top: number;
  left: number;
  choices: EntityChoice[];
  activeIndex: number;
  onSelect: (c: EntityChoice) => void;
  onHover: (i: number) => void;
}) {
  return (
    <div
      // Anchor the popover BELOW the caret. Tweak with a small offset so it
      // doesn't overlap the current line.
      style={{ top: top + 20, left }}
      className="absolute z-30 min-w-[280px] max-w-[400px] bg-background border border-border rounded-md shadow-md py-1"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Insert entity
      </div>
      <ul>
        {choices.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelect(c)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[13px] flex items-center justify-between gap-3",
                i === activeIndex
                  ? "bg-accent text-foreground"
                  : "text-foreground/90 hover:bg-accent/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.label}</div>
                {c.sub && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.sub}
                  </div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {KIND_LABELS[c.kind]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
        ↑↓ navigate · enter / tab insert · esc dismiss
      </div>
    </div>
  );
}

// Mirror-div technique for approximating caret position inside a textarea.
// Build a hidden div with the same styles, copy text up to `index`, then
// measure a marker span at the end of that text.
function caretCoords(
  textarea: HTMLTextAreaElement,
  index: number,
): { top: number; left: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  // Copy the textarea's box model + text styles
  const props = [
    "boxSizing",
    "width",
    "height",
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "lineHeight",
    "tabSize",
  ];
  for (const p of props) {
    (mirror.style as unknown as Record<string, string>)[p] = (
      style as unknown as Record<string, string>
    )[p];
  }
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";

  const before = textarea.value.substring(0, index);
  mirror.textContent = before;
  const marker = document.createElement("span");
  marker.textContent = "@";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const taRect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Position relative to textarea's offsetParent (the editor's wrapping div)
  const top = markerRect.top - mirrorRect.top - textarea.scrollTop;
  const left = markerRect.left - mirrorRect.left - textarea.scrollLeft;

  document.body.removeChild(mirror);
  void taRect; // suppress unused

  return { top, left };
}
