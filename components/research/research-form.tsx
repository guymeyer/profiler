"use client";
import { useState } from "react";
import { Loader2, Upload, X, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { extractDocument, categorizeResearch } from "@/lib/extract/actions";
import type { ResearchArtifact, Person, Customer, Objective } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  initial?: ResearchArtifact;
  people: Person[];
  customers: Customer[];
  objectives: Objective[];
  onSubmit: (next: ResearchArtifact) => void;
  onDelete?: () => void;
  saveLabel?: string;
}

// Track which fields were filled by AI vs. user, so we can show a small
// indicator next to suggested values. We don't lock the field — user can
// overwrite freely.
type AIFilledKeys =
  | "title"
  | "summary"
  | "participants"
  | "methodology"
  | "tags"
  | "source"
  | "content";

export function ResearchForm({
  initial,
  people,
  customers,
  objectives,
  onSubmit,
  onDelete,
  saveLabel = "Save",
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [conductedAt, setConductedAt] = useState(
    initial?.conductedAt?.slice(0, 10) ?? "",
  );
  const [participants, setParticipants] = useState(
    initial?.participants.join(", ") ?? "",
  );
  const [methodology, setMethodology] = useState(initial?.methodology ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [linkedPersonIds, setLinkedPersonIds] = useState<string[]>(
    initial?.linkedPersonIds ?? [],
  );
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>(
    initial?.linkedCustomerIds ?? [],
  );
  const [linkedObjectiveIds, setLinkedObjectiveIds] = useState<string[]>(
    initial?.linkedObjectiveIds ?? [],
  );
  const [uploadedFrom, setUploadedFrom] = useState(initial?.uploadedFrom);
  const [uploading, setUploading] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<AIFilledKeys>>(new Set());
  // Stash the raw extracted text so the user can revert the AI-cleaned body.
  const [rawExtract, setRawExtract] = useState<string | null>(null);

  function clearAIBadge(key: AIFilledKeys) {
    setAiFilled((cur) => {
      if (!cur.has(key)) return cur;
      const next = new Set(cur);
      next.delete(key);
      return next;
    });
  }

  function toggleIn(
    list: string[],
    id: string,
    setter: (next: string[]) => void,
  ) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleUpload(file: File) {
    setError(null);
    setExtractWarning(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const extracted = await extractDocument(fd);
      setContent(extracted.text);
      setRawExtract(extracted.text);
      setUploadedFrom({ filename: file.name, kind: extracted.kind });
      if (extracted.warnings.length > 0) {
        setExtractWarning(extracted.warnings.join(" · "));
      }
      setUploading(false);

      if (!extracted.text.trim()) return;

      // Auto-categorize. Best-effort — failures are silent on the action side,
      // but we still show a small indicator on this side.
      setCategorizing(true);
      try {
        const cat = await categorizeResearch({
          content: extracted.text,
          filename: file.name,
        });
        const filled = new Set<AIFilledKeys>(aiFilled);
        if (cat.title && !title.trim()) {
          setTitle(cat.title);
          filled.add("title");
        }
        if (cat.summary && !summary.trim()) {
          setSummary(cat.summary);
          filled.add("summary");
        }
        if (cat.participants && cat.participants.length > 0 && !participants.trim()) {
          setParticipants(cat.participants.join(", "));
          filled.add("participants");
        }
        if (cat.methodology && !methodology.trim()) {
          setMethodology(cat.methodology);
          filled.add("methodology");
        }
        if (cat.tags && cat.tags.length > 0 && !tags.trim()) {
          setTags(cat.tags.join(", "));
          filled.add("tags");
        }
        if (cat.sourceHint && !source.trim()) {
          setSource(cat.sourceHint);
          filled.add("source");
        }
        // bodyMarkdown is a structured rewrite of the raw extract. Replace the
        // content with it when it comes back — user can revert via the
        // "Restore raw extract" button if they prefer the unprocessed text.
        if (cat.bodyMarkdown) {
          setContent(cat.bodyMarkdown);
          filled.add("content");
        }
        setAiFilled(filled);
      } finally {
        setCategorizing(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
      setCategorizing(false);
    }
  }

  function restoreRawExtract() {
    if (!rawExtract) return;
    setContent(rawExtract);
    clearAIBadge("content");
  }

  function save() {
    const id =
      initial?.id ??
      `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const next: ResearchArtifact = {
      id,
      title: title.trim() || "Untitled research",
      summary: summary.trim(),
      content: content.trim(),
      source: source.trim() || "Internal",
      conductedAt: conductedAt
        ? new Date(conductedAt).toISOString()
        : undefined,
      participants: participants
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      methodology: methodology.trim() || undefined,
      tags: tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      linkedPersonIds,
      linkedCustomerIds,
      linkedObjectiveIds,
      uploadedFrom,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: initial ? new Date().toISOString() : undefined,
    };
    onSubmit(next);
  }

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Upload — at the top so it's the obvious first move. */}
      <UploadCard
        uploading={uploading}
        categorizing={categorizing}
        uploadedFrom={uploadedFrom}
        warning={extractWarning}
        onPick={handleUpload}
        onClear={() => {
          setUploadedFrom(undefined);
          setExtractWarning(null);
        }}
      />

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/[0.05] p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {aiFilled.size > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3 text-sm flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">AI pre-filled {aiFilled.size} field
              {aiFilled.size === 1 ? "" : "s"}.</span>{" "}
            <span className="text-muted-foreground">
              Review and edit — anything you change clears the suggestion badge.
            </span>
          </div>
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <FieldLabel
            label="Title"
            required
            ai={aiFilled.has("title")}
          />
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearAIBadge("title");
            }}
            placeholder="e.g. Q1 buyer interviews — mid-market FinOps"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
          <div>
            <FieldLabel label="Source / team" ai={aiFilled.has("source")} />
            <Input
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                clearAIBadge("source");
              }}
              placeholder="Customer Research Team"
              className="mt-1"
            />
          </div>
          <div>
            <FieldLabel label="Date conducted" />
            <Input
              type="date"
              value={conductedAt}
              onChange={(e) => setConductedAt(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <FieldLabel
            label="Participants (comma-separated)"
            ai={aiFilled.has("participants")}
          />
          <Input
            value={participants}
            onChange={(e) => {
              setParticipants(e.target.value);
              clearAIBadge("participants");
            }}
            placeholder="Jane Doe (CFO @ Acme), Bob Lee (Director @ Globex)"
            className="mt-1"
          />
        </div>

        <div>
          <FieldLabel label="Methodology" ai={aiFilled.has("methodology")} />
          <Input
            value={methodology}
            onChange={(e) => {
              setMethodology(e.target.value);
              clearAIBadge("methodology");
            }}
            placeholder="45-min semi-structured interviews, recorded with consent"
            className="mt-1"
          />
        </div>

        <div>
          <FieldLabel
            label="Tags (comma-separated)"
            ai={aiFilled.has("tags")}
          />
          <Input
            value={tags}
            onChange={(e) => {
              setTags(e.target.value);
              clearAIBadge("tags");
            }}
            placeholder="pricing, mid-market, finops, q1-2026"
            className="mt-1"
          />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Body</h3>
        <div>
          <FieldLabel
            label="Executive summary"
            ai={aiFilled.has("summary")}
          />
          <Textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              clearAIBadge("summary");
            }}
            placeholder="One short paragraph the reader will see first when this research is injected into an analysis."
            className="mt-1 min-h-[72px]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel
              label="Full content"
              required
              ai={aiFilled.has("content")}
            />
            {aiFilled.has("content") &&
              rawExtract &&
              rawExtract !== content && (
                <button
                  onClick={restoreRawExtract}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  Restore raw extract
                </button>
              )}
          </div>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              clearAIBadge("content");
            }}
            placeholder="Transcript, raw notes, or summarized findings. Uploads land here automatically — you can edit after."
            className="mt-1 min-h-[280px] font-mono text-[13px]"
          />
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
            <span>{content.length.toLocaleString()} characters</span>
            {aiFilled.has("content") && rawExtract && (
              <span className="text-muted-foreground/70">
                AI rewrote {rawExtract.length.toLocaleString()} →{" "}
                {content.length.toLocaleString()} chars
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Linkage</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Attach this research to the people, customers, and objectives it
          informs. These links surface as suggestions when running analyses.
        </p>

        <div className="space-y-4">
          <LinkSection
            title="People"
            items={people.map((p) => ({
              id: p.id,
              label: p.name,
              sub: p.title,
            }))}
            selected={linkedPersonIds}
            onToggle={(id) =>
              toggleIn(linkedPersonIds, id, setLinkedPersonIds)
            }
          />
          <LinkSection
            title="Customers"
            items={customers.map((c) => ({
              id: c.id,
              label: c.name,
              sub: c.industry,
            }))}
            selected={linkedCustomerIds}
            onToggle={(id) =>
              toggleIn(linkedCustomerIds, id, setLinkedCustomerIds)
            }
          />
          <LinkSection
            title="Objectives"
            items={objectives.map((o) => ({ id: o.id, label: o.title }))}
            selected={linkedObjectiveIds}
            onToggle={(id) =>
              toggleIn(linkedObjectiveIds, id, setLinkedObjectiveIds)
            }
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-sm text-muted-foreground hover:text-danger mr-auto"
          >
            Delete
          </button>
        )}
        <Button onClick={save} disabled={!canSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  ai,
}: {
  label: string;
  required?: boolean;
  ai?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
      {label}
      {required && <span className="text-danger">*</span>}
      {ai && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5"
          title="Pre-filled by AI — edit to clear this indicator"
        >
          <Sparkles className="w-2.5 h-2.5" />
          AI
        </span>
      )}
    </label>
  );
}

function UploadCard({
  uploading,
  categorizing,
  uploadedFrom,
  warning,
  onPick,
  onClear,
}: {
  uploading: boolean;
  categorizing: boolean;
  uploadedFrom?: { filename: string; kind: string };
  warning: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
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
                AI categorizing &amp; cleaning up…
              </div>
              <div className="text-xs text-muted-foreground">
                Extracting metadata + rewriting the body as structured
                markdown.
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
              <div className="font-medium text-sm">
                Drop a research artifact, or click to choose
              </div>
              <div className="text-xs text-muted-foreground">
                PDF, DOCX, TXT, or MD · up to 10 MB · Claude auto-fills the
                form and rewrites the body as clean markdown
              </div>
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

function LinkSection({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
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
          onClick={() => setShowAll((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Hide list" : `Browse all (${items.length})`}
        </button>
      </div>
      {displayItems.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          None linked.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {displayItems.map((item) => {
            const sel = selected.includes(item.id);
            return (
              <button
                key={item.id}
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
