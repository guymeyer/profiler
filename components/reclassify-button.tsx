"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfilerStore } from "@/lib/store";
import { getDocumentKindConfig } from "@/lib/document-kinds";
import type {
  Document,
  DocumentBase,
  DocumentKind,
  MemoProperties,
  PRDProperties,
  ResearchProperties,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Move a document from one Knowledge kind to another. The classifier
// occasionally misroutes; this is the escape hatch.
//
// Strategy: no LLM round-trip. Carry the common DocumentBase fields
// verbatim. Build kind-specific properties from defaults — registered
// in the kind config — that the user can edit on the destination page.

type ReclassifyKind = "research" | "prd" | "memo";

const KIND_LABELS: Record<ReclassifyKind, string> = {
  research: "Research",
  prd: "PRD",
  memo: "Memo",
};

const ID_PREFIX: Record<ReclassifyKind, string> = {
  research: "res",
  prd: "prd",
  memo: "memo",
};

export function ReclassifyButton({ current }: { current: Document }) {
  const router = useRouter();
  const saveDocument = useProfilerStore((s) => s.saveDocument);
  const deleteDocument = useProfilerStore((s) => s.deleteDocument);

  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  // Only research/prd/memo are reclassifiable through this UI.
  if (
    current.kind !== "research" &&
    current.kind !== "prd" &&
    current.kind !== "memo"
  ) {
    return null;
  }
  const currentKind = current.kind as ReclassifyKind;

  const otherKinds = (Object.keys(KIND_LABELS) as ReclassifyKind[]).filter(
    (k) => k !== currentKind,
  );

  function moveTo(target: ReclassifyKind) {
    setMoving(true);
    setOpen(false);

    const now = new Date().toISOString();
    const baseId = `${ID_PREFIX[target]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const base: DocumentBase = {
      id: baseId,
      kind: target as DocumentKind,
      title: current.title,
      summary: current.summary,
      content: current.content,
      source: current.source,
      tags: current.tags,
      linkedPersonIds: current.linkedPersonIds,
      linkedCustomerIds: current.linkedCustomerIds,
      linkedObjectiveIds: current.linkedObjectiveIds,
      linkedBusinessUnitId: current.linkedBusinessUnitId,
      uploadedFrom: current.uploadedFrom,
      sourceUrl: current.sourceUrl,
      createdAt: current.createdAt,
      updatedAt: now,
    };

    // Default properties for the target kind. Memo summaries seed the
    // PRD problem statement as a useful hint.
    let next: Document;
    if (target === "research") {
      const properties = getDocumentKindConfig("research").defaultProperties() as ResearchProperties;
      next = { ...base, kind: "research", properties };
    } else if (target === "prd") {
      const defaults = getDocumentKindConfig("prd").defaultProperties() as PRDProperties;
      const properties: PRDProperties =
        currentKind === "memo"
          ? { ...defaults, problem: current.summary }
          : defaults;
      next = { ...base, kind: "prd", properties };
    } else {
      const properties = getDocumentKindConfig("memo").defaultProperties() as MemoProperties;
      next = { ...base, kind: "memo", properties };
    }

    saveDocument(next);
    deleteDocument(current.id);
    router.push(`/documents/${next.id}`);
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="md"
        onClick={() => setOpen((v) => !v)}
        disabled={moving}
      >
        {moving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Moving…
          </>
        ) : (
          <>
            <Move className="w-3.5 h-3.5" />
            Move to…
            <ChevronDown className="w-3.5 h-3.5" />
          </>
        )}
      </Button>
      {open && (
        <>
          {/* Click-outside backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            className={cn(
              "absolute right-0 top-full mt-1 z-40 min-w-[220px] rounded-md border border-border bg-background shadow-md py-1",
            )}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Move this {KIND_LABELS[currentKind]} to…
            </div>
            {otherKinds.map((k) => (
              <button
                key={k}
                onClick={() => moveTo(k)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                {KIND_LABELS[k]}
              </button>
            ))}
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t mt-1">
              The current document is replaced. Kind-specific fields will
              need to be filled on the destination page.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
