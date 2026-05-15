"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Pencil, Save, X } from "lucide-react";

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
}

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
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
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
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck
          className="w-full min-h-[480px] rounded-md border bg-background p-4 font-mono text-[13px] leading-relaxed resize-y"
        />
      ) : (
        <div className="prose-memo max-w-none rounded-md border bg-surface/40 p-5 min-h-[480px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
