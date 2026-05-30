"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { DocumentDropzone } from "@/components/document-dropzone";
import {
  MarkdownEditor,
  type EntityChoice,
} from "@/components/admin/markdown-editor";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { extractDocument } from "@/lib/extract/actions";
import { categorizeMemo } from "@/lib/extract/memo-actions";
import {
  blankMarkdownFor,
  documentToMarkdown,
  markdownToDocument,
} from "@/lib/document-md";
import { extractMetricsFromMemo } from "@/lib/llm/extract-metrics";
import { suggestExpertiseFromArtifact } from "@/lib/llm/suggest-expertise";
import { mergeExpertiseSuggestion } from "@/lib/expertise-merge";
import { documentToMemo } from "@/lib/document-adapters";
import type { MemoDocument, MemoKind } from "@/lib/types";

export default function NewMemoPage() {
  const router = useRouter();
  const saveDocument = useProfilerStore((s) => s.saveDocument);
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const replaceMetricsForMemo = useProfilerStore(
    (s) => s.replaceMetricsForMemo,
  );
  const customers = useProfilerStore((s) => s.customers ?? {});
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const people = useEffectivePeople();

  const [draft, setDraft] = useState<string>(blankMarkdownFor("memo"));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stage, setStage] = useState<
    | { kind: "idle" }
    | { kind: "extracting" }
    | { kind: "categorizing"; filename: string }
  >({ kind: "idle" });
  const [uploadedFrom, setUploadedFrom] = useState<
    { filename: string; kind: string } | undefined
  >(undefined);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    setExtractWarning(null);
    setStage({ kind: "extracting" });
    try {
      const fd = new FormData();
      fd.set("file", file);
      const extracted = await extractDocument(fd);
      if (extracted.warnings.length > 0) {
        setExtractWarning(extracted.warnings.join(" · "));
      }
      setUploadedFrom({ filename: file.name, kind: extracted.kind });
      if (!extracted.text.trim()) {
        setStage({ kind: "idle" });
        setError("No text could be extracted from the file.");
        return;
      }
      setStage({ kind: "categorizing", filename: file.name });
      const cat = await categorizeMemo({
        content: extracted.text,
        filename: file.name,
      });
      const seed: MemoDocument = {
        id: "",
        kind: "memo",
        title: cat.title ?? file.name.replace(/\.[^.]+$/, ""),
        summary: cat.summary ?? "",
        // Intake preserves the source content verbatim — only metadata
        // gets LLM-extracted. Use `Synthesize` if you want AI to rewrite.
        content: extracted.text,
        source: cat.sourceHint,
        tags: cat.tags ?? [],
        linkedPersonIds: [],
        linkedCustomerIds: [],
        linkedObjectiveIds: [],
        uploadedFrom: { filename: file.name, kind: extracted.kind },
        createdAt: new Date().toISOString(),
        properties: {
          memoKind: (cat.memoKind ?? "other") as MemoKind,
          keyClaims: cat.keyClaims ?? [],
          decisions: cat.decisions ?? [],
        },
      };
      setDraft(documentToMarkdown(seed));
      setStage({ kind: "idle" });
    } catch (e) {
      setStage({ kind: "idle" });
      setError((e as Error).message ?? "Upload failed.");
    }
  }

  function handleSave() {
    const { document, warnings: w } = markdownToDocument<"memo">(draft, {
      kind: "memo",
    });
    setWarnings(w);
    if (uploadedFrom && !document.uploadedFrom) {
      document.uploadedFrom = uploadedFrom;
    }
    saveDocument(document);
    router.push(`/documents/${document.id}`);
    const legacy = documentToMemo(document);
    extractMetricsFromMemo({
      memo: legacy,
      businessUnits: Object.values(businessUnits),
    })
      .then((m) => replaceMetricsForMemo(document.id, m))
      .catch((e) => console.error("memo metric extraction failed:", e));
    for (const pid of document.linkedPersonIds) {
      const person = people.find((p) => p.id === pid);
      if (!person || person.customerId) continue;
      suggestExpertiseFromArtifact({
        artifact: { kind: "memo", item: legacy },
        person,
      })
        .then((s) => {
          const merged = mergeExpertiseSuggestion(person, s);
          if (merged) saveProfile(merged);
        })
        .catch((e) =>
          console.error(`expertise extraction failed for ${person.name}:`, e),
        );
    }
  }

  const entityChoices: EntityChoice[] = [
    ...people.map((p) => ({
      id: p.id,
      label: p.name,
      sub: `${p.title}${p.team ? ` · ${p.team}` : ""}`,
      kind: "person" as const,
    })),
    ...Object.values(customers).map((c) => ({
      id: c.id,
      label: c.name,
      sub: c.industry,
      kind: "customer" as const,
    })),
    ...OBJECTIVES.map((o) => ({
      id: o.id,
      label: o.title,
      sub: o.description,
      kind: "objective" as const,
    })),
    ...Object.values(businessUnits).map((b) => ({
      id: b.id,
      label: b.name,
      sub: b.description,
      kind: "business-unit" as const,
    })),
  ];

  const busy = stage.kind !== "idle";

  return (
    <div>
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" />
        Knowledge
      </Link>

      <PageHeader
        eyebrow="Memo"
        title="Add memo"
        meta="Upload a file or paste, then review the AI-assembled markdown."
      />

      <Section title="Source">
        <DocumentDropzone
          uploading={stage.kind === "extracting"}
          categorizing={stage.kind === "categorizing"}
          uploadedFrom={uploadedFrom}
          warning={extractWarning}
          onPick={handleUpload}
          onClear={() => {
            setUploadedFrom(undefined);
            setExtractWarning(null);
          }}
          emptyLabel="Drop a memo, brief, or post-mortem"
          categorizingLabel={
            stage.kind === "categorizing"
              ? `AI extracting memo fields from ${stage.filename}…`
              : "AI extracting memo fields…"
          }
        />
      </Section>

      {error && (
        <div className="text-[13px] text-danger mb-2">{error}</div>
      )}

      <Section title="Markdown" divider>
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSave}
          saving={busy}
          warnings={warnings}
          saveLabel="Create memo"
          entities={entityChoices}
        />
      </Section>

      <p className="mt-3 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        After save: metric extraction + expertise inference for any linked
        people run in the background.
        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
      </p>
    </div>
  );
}
