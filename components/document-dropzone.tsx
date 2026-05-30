"use client";
import { useState } from "react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shared upload widget for any document-ingestion form. The parent owns the
// extract + categorize calls and the form fields; this component just
// presents the file picker UI + busy states + clear button.

export interface UploadedFrom {
  filename: string;
  kind: string;
}

interface Props {
  uploading: boolean;
  categorizing: boolean;
  uploadedFrom?: UploadedFrom;
  warning: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  // Per-document-type copy. Sensible defaults match the original research UX.
  emptyLabel?: string;
  emptyHint?: string;
  categorizingLabel?: string;
}

export function DocumentDropzone({
  uploading,
  categorizing,
  uploadedFrom,
  warning,
  onPick,
  onClear,
  emptyLabel = "Drop a document, or click to choose",
  emptyHint = "PDF, DOCX, TXT, or MD · up to 10 MB · Claude auto-fills the form and rewrites the body as clean markdown",
  categorizingLabel = "AI categorizing & cleaning up…",
}: Props) {
  const [drag, setDrag] = useState(false);
  const busy = uploading || categorizing;
  return (
    <Card className="p-0 overflow-hidden border-primary/20">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className={cn(
          "flex items-center gap-4 p-5 cursor-pointer transition-colors",
          drag && "bg-primary/[0.06]",
          busy && "cursor-wait",
        )}
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
          disabled={busy}
        />
        <div
          className={cn(
            "w-12 h-12 rounded-lg inline-flex items-center justify-center shrink-0",
            uploadedFrom
              ? "bg-success/10 text-success"
              : "bg-primary/10 text-primary",
          )}
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : uploadedFrom ? (
            <FileText className="w-5 h-5" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {uploading ? (
            <>
              <div className="font-medium text-sm">Extracting text…</div>
              <div className="text-xs text-muted-foreground">
                PDF / DOCX parsed server-side.
              </div>
            </>
          ) : categorizing ? (
            <>
              <div className="font-medium text-sm inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {categorizingLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                Extracting metadata + rewriting the body as structured markdown.
              </div>
            </>
          ) : uploadedFrom ? (
            <>
              <div className="font-medium text-sm truncate">
                {uploadedFrom.filename}
              </div>
              <div className="text-xs text-muted-foreground">
                {uploadedFrom.kind.toUpperCase()} · extracted into the body
                below. Click to replace.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-sm">{emptyLabel}</div>
              <div className="text-xs text-muted-foreground">{emptyHint}</div>
            </>
          )}
        </div>
        {uploadedFrom && !busy && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="text-xs text-muted-foreground hover:text-danger shrink-0"
            aria-label="Clear upload"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </label>
      {warning && (
        <div className="px-5 py-2 text-[11px] text-warning border-t border-warning/30 bg-warning/[0.04]">
          {warning}
        </div>
      )}
    </Card>
  );
}
