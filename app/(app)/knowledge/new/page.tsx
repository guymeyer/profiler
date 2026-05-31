"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { DocumentDropzone } from "@/components/document-dropzone";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { extractDocument } from "@/lib/extract/actions";
import { categorizeDocument } from "@/lib/extract/document-actions";
import { fetchUrl } from "@/lib/extract/url-fetch";
import {
  classifyDocument,
  type ClassificationResult,
  type ClassifiedKind,
} from "@/lib/extract/classify";
import { extractMetricsFromDocument } from "@/lib/llm/extract-metrics";
import {
  suggestExpertiseFromArtifact,
  type ArtifactSummary,
} from "@/lib/llm/suggest-expertise";
import { mergeExpertiseSuggestion } from "@/lib/expertise-merge";
import { useCustomerCompanies } from "@/lib/hooks/use-companies";
import type {
  MemoDocument,
  PRDDocument,
  PRDStatus,
  ResearchDocument,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const AUTO_ROUTE_THRESHOLD = 0.8;

type Stage =
  | { kind: "idle" }
  | { kind: "extracting" }
  | { kind: "classifying"; text: string; filename?: string }
  | {
      kind: "chooser";
      text: string;
      filename?: string;
      classification: ClassificationResult;
    }
  | {
      kind: "auto-routing";
      text: string;
      filename?: string;
      classification: ClassificationResult;
    }
  | { kind: "categorizing"; kind2: ClassifiedKind; confidence: number };

const KIND_META: Record<
  ClassifiedKind,
  {
    label: string;
    blurb: string;
    Icon: typeof BookOpen;
  }
> = {
  research: {
    label: "Research",
    blurb: "Primary observation — interview, study, customer feedback.",
    Icon: BookOpen,
  },
  prd: {
    label: "PRD",
    blurb: "Planning — problem, solution, target users, success metrics.",
    Icon: ClipboardList,
  },
  memo: {
    label: "Memo",
    blurb: "Narrative — strategy, brief, post-mortem, market read.",
    Icon: FileText,
  },
};

// useSearchParams() forces this page to be client-rendered. Next 16 bails
// the prerender unless the consuming subtree is inside a Suspense, so we
// split the page: a thin default export wraps the real implementation in
// a Suspense fallback that matches the chrome.
export default function KnowledgeIntakePageWrapper() {
  return (
    <Suspense fallback={null}>
      <KnowledgeIntakePage />
    </Suspense>
  );
}

function KnowledgeIntakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?kind=research|prd|memo bypasses the classifier — the kind is already
  // known (came from a kind-specific entry point), so we jump straight to
  // categorize → review.
  const kindHint = (() => {
    const raw = searchParams.get("kind");
    if (raw === "research" || raw === "prd" || raw === "memo") return raw;
    return null;
  })();

  const customers = useCustomerCompanies();
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const people = useEffectivePeople();

  const saveDocument = useProfilerStore((s) => s.saveDocument);
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const replaceMetricsForDocument = useProfilerStore(
    (s) => s.replaceMetricsForDocument,
  );

  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlSource, setUrlSource] = useState<string | undefined>(undefined);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const knownEntities = useMemo(
    () => ({
      people: people.map((p) => ({ id: p.id, name: p.name, title: p.title })),
      customers: Object.values(customers).map((c) => ({
        id: c.id,
        name: c.name,
      })),
      objectives: OBJECTIVES.map((o) => ({ id: o.id, title: o.title })),
      businessUnits: Object.values(businessUnits).map((b) => ({
        id: b.id,
        name: b.name,
      })),
    }),
    [people, customers, businessUnits],
  );

  async function ingestText(text: string, filename?: string) {
    setError(null);
    if (!text.trim()) {
      setError("No text to ingest.");
      return;
    }
    // ?kind=… short-circuit: the kind is already known, so skip the
    // classifier and jump straight to categorize. Empty suggestedLinks
    // since we didn't run classification — the user fills them in via the
    // Properties panel on the detail page.
    if (kindHint) {
      await routeAndSave(text, filename, kindHint, {
        kind: kindHint,
        confidence: 1,
        rationale: "Kind specified via query parameter.",
        alternates: [],
        suggestedLinks: {
          tags: [],
          personIds: [],
          customerIds: [],
          objectiveIds: [],
          businessUnitId: undefined,
        },
        generatedBy: "mock",
      });
      return;
    }
    setStage({ kind: "classifying", text, filename });
    try {
      const classification = await classifyDocument({
        text,
        filename,
        knownEntities,
      });
      if (classification.confidence >= AUTO_ROUTE_THRESHOLD) {
        setStage({
          kind: "auto-routing",
          text,
          filename,
          classification,
        });
        // brief "Detected: X" beat before categorize, so the user sees what
        // the system decided.
        await wait(700);
        await routeAndSave(text, filename, classification.kind, classification);
      } else {
        setStage({
          kind: "chooser",
          text,
          filename,
          classification,
        });
      }
    } catch (e) {
      setStage({ kind: "idle" });
      setError((e as Error).message ?? "Classification failed.");
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    setExtractWarning(null);
    setUrlSource(undefined);
    setStage({ kind: "extracting" });
    try {
      const fd = new FormData();
      fd.set("file", file);
      const extracted = await extractDocument(fd);
      if (extracted.warnings.length > 0) {
        setExtractWarning(extracted.warnings.join(" · "));
      }
      if (!extracted.text.trim()) {
        setStage({ kind: "idle" });
        setError("No text could be extracted from this file.");
        return;
      }
      await ingestText(extracted.text, file.name);
    } catch (e) {
      setStage({ kind: "idle" });
      setError((e as Error).message ?? "Upload failed.");
    }
  }

  async function handlePaste() {
    setUrlSource(undefined);
    await ingestText(pasteText, undefined);
  }

  async function handleUrl() {
    if (!urlInput.trim()) return;
    setError(null);
    setExtractWarning(null);
    setStage({ kind: "extracting" });
    try {
      const result = await fetchUrl(urlInput.trim());
      if (result.warnings.length > 0) {
        setExtractWarning(result.warnings.join(" · "));
      }
      if (!result.text.trim()) {
        setStage({ kind: "idle" });
        setError("No text could be extracted from this URL.");
        return;
      }
      setUrlSource(result.url);
      const filename = result.title ?? new URL(result.url).hostname;
      await ingestText(result.text, filename);
    } catch (e) {
      setStage({ kind: "idle" });
      setError((e as Error).message ?? "URL fetch failed.");
    }
  }

  async function chooseKind(kind: ClassifiedKind) {
    if (stage.kind !== "chooser") return;
    const { text, filename, classification } = stage;
    await routeAndSave(text, filename, kind, classification);
  }

  function runExpertise(artifact: ArtifactSummary, personIds: string[]) {
    for (const personId of personIds) {
      const person = people.find((p) => p.id === personId);
      if (!person || person.customerId) continue;
      suggestExpertiseFromArtifact({ artifact, person })
        .then((suggestion) => {
          const merged = mergeExpertiseSuggestion(person, suggestion);
          if (merged) saveProfile(merged);
        })
        .catch((e) =>
          console.error(
            `expertise extraction failed for ${person.name}:`,
            e,
          ),
        );
    }
  }

  // Categorize → build doc seed → save + route to /documents/[id]. The
  // detail page is the unified editing surface, so we hand off directly
  // instead of staging a "review" step with a separate editor instance.
  async function routeAndSave(
    text: string,
    filename: string | undefined,
    kind: ClassifiedKind,
    classification: ClassificationResult,
  ) {
    setStage({
      kind: "categorizing",
      kind2: kind,
      confidence: classification.confidence,
    });
    try {
      const uploadedFrom =
        filename && !urlSource ? { filename, kind: "auto" } : undefined;
      const cat = await categorizeDocument({ content: text, filename }, kind);
      const id = newDocumentId(kind);
      const base = {
        id,
        title: cat.title?.trim() || defaultTitleFor(kind),
        summary: cat.summary ?? "",
        // Intake preserves the source verbatim — synthesis is where
        // AI rewrites happen.
        content: text,
        tags: dedupe([
          ...(cat.tags ?? []),
          ...classification.suggestedLinks.tags,
        ]),
        linkedPersonIds: classification.suggestedLinks.personIds,
        linkedCustomerIds: classification.suggestedLinks.customerIds,
        linkedObjectiveIds: classification.suggestedLinks.objectiveIds,
        uploadedFrom,
        sourceUrl: urlSource,
        createdAt: new Date().toISOString(),
      };

      let seed: ResearchDocument | PRDDocument | MemoDocument;
      if (cat.kind === "research") {
        seed = {
          ...base,
          kind: "research",
          source: cat.sourceHint ?? "Internal",
          properties: {
            participants: cat.participants ?? [],
            methodology: cat.methodology,
          },
        };
      } else if (cat.kind === "prd") {
        seed = {
          ...base,
          kind: "prd",
          source: cat.sourceHint,
          linkedBusinessUnitId: classification.suggestedLinks.businessUnitId,
          properties: {
            problem: cat.problem ?? "",
            solution: cat.solution ?? "",
            targetUsers: cat.targetUsers ?? [],
            successMetrics: cat.successMetrics ?? [],
            status: (cat.status ?? "draft") as PRDStatus,
            targetShipDate: cat.targetShipDate
              ? new Date(cat.targetShipDate).toISOString()
              : undefined,
          },
        };
      } else {
        seed = {
          ...base,
          kind: "memo",
          source: cat.sourceHint,
          linkedBusinessUnitId: classification.suggestedLinks.businessUnitId,
          properties: {
            memoKind: cat.memoKind ?? "other",
            keyClaims: cat.keyClaims ?? [],
            decisions: cat.decisions ?? [],
          },
        };
      }

      saveDocument(seed);
      extractMetricsFromDocument(seed, Object.values(businessUnits))
        .then((m) => replaceMetricsForDocument(seed.id, seed.kind, m))
        .catch((e) =>
          console.error(`${seed.kind} metric extraction failed:`, e),
        );
      runExpertise(
        { kind: seed.kind, document: seed } as Parameters<typeof runExpertise>[0],
        seed.linkedPersonIds,
      );
      router.push(`/documents/${seed.id}`);
    } catch (e) {
      setStage({ kind: "idle" });
      setError((e as Error).message ?? "Categorization failed.");
    }
  }

  function newDocumentId(kind: "research" | "prd" | "memo"): string {
    const prefix = kind === "research" ? "res" : kind === "prd" ? "prd" : "memo";
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function defaultTitleFor(kind: "research" | "prd" | "memo"): string {
    return kind === "research"
      ? "Untitled research"
      : kind === "prd"
        ? "Untitled PRD"
        : "Untitled memo";
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Knowledge repository
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Add to Knowledge
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Drop in anything — interview transcript, PRD, strategy memo, market
          read. Claude reads it, decides what kind it is, files it in the
          right place, and links it to anyone or anything it explicitly
          mentions.
        </p>
      </header>

      {error && (
        <Card className="p-4 mb-4 border-danger/40 bg-danger/5 text-sm text-danger">
          {error}
        </Card>
      )}

      {stage.kind === "idle" && (
        <>
          <DocumentDropzone
            uploading={false}
            categorizing={false}
            uploadedFrom={undefined}
            warning={extractWarning}
            onPick={handleUpload}
            onClear={() => setExtractWarning(null)}
            emptyLabel="Drop anything — file or paste below"
            emptyHint="PDF, DOCX, TXT, or MD · Claude classifies + categorizes + auto-files"
          />

          <Card className="p-5 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Or paste a URL</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Public pages only — blog posts, press releases, competitor
              announcements. Paywalled, JS-rendered, or auth-gated pages
              won&apos;t extract; paste the text instead.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                type="url"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && urlInput.trim()) {
                    e.preventDefault();
                    handleUrl();
                  }
                }}
              />
              <Button onClick={handleUrl} disabled={!urlInput.trim()}>
                <Sparkles className="w-3.5 h-3.5" />
                Fetch & file
              </Button>
            </div>
          </Card>

          <Card className="p-5 mt-4">
            <h2 className="font-semibold mb-2">Or paste text directly</h2>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste a memo, an email, a transcript snippet — anything…"
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex justify-end mt-3">
              <Button
                onClick={handlePaste}
                disabled={!pasteText.trim()}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Classify and file
              </Button>
            </div>
          </Card>

          <div className="mt-6 text-xs text-muted-foreground">
            Prefer to pick the kind yourself? Use{" "}
            <Link href="/research/new" className="text-primary hover:underline">
              research
            </Link>
            ,{" "}
            <Link href="/prds/new" className="text-primary hover:underline">
              PRD
            </Link>
            , or{" "}
            <Link href="/memos/new" className="text-primary hover:underline">
              memo
            </Link>{" "}
            directly.
          </div>
        </>
      )}

      {stage.kind === "extracting" && (
        <BusyCard
          label="Extracting text…"
          hint="Parsing the document server-side."
        />
      )}

      {stage.kind === "classifying" && (
        <BusyCard
          label="Reading and classifying…"
          hint="Claude is figuring out what kind of document this is."
        />
      )}

      {stage.kind === "auto-routing" && (
        <DetectionCard
          classification={stage.classification}
          variant="auto"
        />
      )}

      {stage.kind === "categorizing" && (
        <BusyCard
          label={`Filing as ${KIND_META[stage.kind2].label}…`}
          hint="Pulling structured fields and saving."
        />
      )}

      {stage.kind === "chooser" && (
        <ChooserCard
          classification={stage.classification}
          onPick={chooseKind}
        />
      )}

    </div>
  );
}

function BusyCard({ label, hint }: { label: string; hint: string }) {
  return (
    <Card className="p-8">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">{hint}</div>
        </div>
      </div>
    </Card>
  );
}

function DetectionCard({
  classification,
}: {
  classification: ClassificationResult;
  variant: "auto";
}) {
  const meta = KIND_META[classification.kind];
  const Icon = meta.Icon;
  return (
    <Card className="p-6 border-primary/30 bg-primary/[0.04]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary inline-flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
            Detected as
          </div>
          <div className="text-lg font-semibold flex items-center gap-2 flex-wrap">
            {meta.label}
            <ConfidencePill confidence={classification.confidence} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {classification.rationale}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Filing…
          </div>
        </div>
      </div>
    </Card>
  );
}

function ChooserCard({
  classification,
  onPick,
}: {
  classification: ClassificationResult;
  onPick: (kind: ClassifiedKind) => void;
}) {
  // Build a unified ordered list: primary first, then alternates.
  const options: { kind: ClassifiedKind; confidence: number; rationale: string }[] =
    [
      {
        kind: classification.kind,
        confidence: classification.confidence,
        rationale: classification.rationale,
      },
      ...classification.alternates,
    ];
  // Dedupe by kind (in case alternates include the primary).
  const seen = new Set<ClassifiedKind>();
  const deduped = options.filter((o) => {
    if (seen.has(o.kind)) return false;
    seen.add(o.kind);
    return true;
  });

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">
          Low confidence — pick a kind
        </div>
        <p className="text-sm text-foreground/90">
          Claude isn&apos;t sure where this belongs. Most likely:{" "}
          <strong>{KIND_META[classification.kind].label}</strong>{" "}
          ({Math.round(classification.confidence * 100)}%). Pick one to file.
        </p>
      </div>
      <div className="space-y-2">
        {deduped.map((opt) => {
          const meta = KIND_META[opt.kind];
          const Icon = meta.Icon;
          const isPrimary = opt.kind === classification.kind;
          return (
            <button
              key={opt.kind}
              type="button"
              onClick={() => onPick(opt.kind)}
              className={cn(
                "w-full text-left flex items-start gap-3 p-4 rounded-lg border transition-colors",
                isPrimary
                  ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08]"
                  : "border-border hover:bg-accent/40",
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-md inline-flex items-center justify-center shrink-0",
                  isPrimary
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold">{meta.label}</span>
                  <ConfidencePill confidence={opt.confidence} />
                  {isPrimary && (
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      Suggested
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {opt.rationale}
                </p>
                <p className="text-[11px] text-muted-foreground/70 leading-snug mt-1">
                  {meta.blurb}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.8
      ? "bg-emerald-100 text-emerald-700"
      : confidence >= 0.5
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
        tone,
      )}
    >
      {pct}%
    </span>
  );
}

function dedupe(arr: string[]): string[] {
  return Array.from(
    new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0)),
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
