"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileSearch,
  Sparkles,
  Upload,
  ClipboardPaste,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { OBJECTIVES } from "@/lib/data/objectives";
import { useEffectivePeople, useInternalPeople, useCustomerEmployees } from "@/lib/people-hooks";
import { useProfilerStore } from "@/lib/store";
import { extractDocument } from "@/lib/extract/actions";
import type {
  AnalyzeInput,
  PartialRecommendation,
} from "@/lib/llm/analyze";
import type { RecommendationResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ARTIFACT_TYPE_LABELS, type ArtifactType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SAMPLE_ARTIFACTS } from "@/lib/data/sample-artifacts";

export function AnalyzeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const INTERNAL_PEOPLE = useInternalPeople();
  const ALL_PEOPLE = useEffectivePeople();
  const storedPersonIds = useProfilerStore((s) => s.selectedPersonIds);
  const storedObjectiveIds = useProfilerStore((s) => s.selectedObjectiveIds);
  const storedIntent = useProfilerStore((s) => s.audienceIntent ?? "");
  const customers = useProfilerStore((s) => s.customers ?? {});
  const selectedCustomerId = useProfilerStore((s) => s.selectedCustomerId);
  const selectedCustomer = selectedCustomerId
    ? customers[selectedCustomerId]
    : undefined;
  const researchMap = useProfilerStore((s) => s.research ?? {});
  const selectedResearchIds = useProfilerStore(
    (s) => s.selectedResearchIds ?? [],
  );
  const selectedResearch = selectedResearchIds
    .map((id) => researchMap[id])
    .filter(Boolean);
  const okrsMap = useProfilerStore((s) => s.okrs ?? {});
  const selectedOKRIds = useProfilerStore((s) => s.selectedOKRIds ?? []);
  const selectedOKRs = selectedOKRIds
    .map((id) => okrsMap[id])
    .filter(Boolean);
  const setSelection = useProfilerStore((s) => s.setSelection);
  const togglePerson = useProfilerStore((s) => s.togglePerson);
  const toggleObjective = useProfilerStore((s) => s.toggleObjective);
  const storeResult = useProfilerStore((s) => s.storeResult);
  const addRecent = useProfilerStore((s) => s.addRecentResult);

  // Seed selections from URL once
  useEffect(() => {
    const personParam = params.get("personIds");
    const objectiveParam = params.get("objectiveIds");
    if (personParam || objectiveParam) {
      setSelection({
        personIds: personParam ? personParam.split(",").filter(Boolean) : storedPersonIds,
        objectiveIds: objectiveParam ? objectiveParam.split(",").filter(Boolean) : storedObjectiveIds,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strategyMode = params.get("strategy") === "1";

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ArtifactType>("strategy-memo");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [streamingPartial, setStreamingPartial] =
    useState<import("@/lib/llm/analyze").PartialRecommendation | null>(null);

  // Lets in-flight analysis complete (and persist to the store) even if the
  // user navigates away — but skip the auto-redirect so they aren't yanked.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const selectedPeople = useMemo(
    () => ALL_PEOPLE.filter((p) => storedPersonIds.includes(p.id)),
    [ALL_PEOPLE, storedPersonIds],
  );
  const selectedObjectives = useMemo(
    () => OBJECTIVES.filter((o) => storedObjectiveIds.includes(o.id)),
    [storedObjectiveIds],
  );

  const canSubmit =
    (selectedPeople.length > 0 ||
      selectedObjectives.length > 0 ||
      !!selectedCustomer) &&
    (strategyMode || title.trim().length > 0) &&
    (strategyMode || content.trim().length > 0) &&
    !submitting;

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      // Plain text / markdown can be read directly client-side.
      if (
        file.type.startsWith("text/") ||
        /\.(md|markdown|txt)$/i.test(file.name)
      ) {
        const text = await file.text();
        setContent(text);
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
        return;
      }

      // PDF and DOCX go through the server-side extractor.
      const lower = file.name.toLowerCase();
      if (
        file.type === "application/pdf" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        lower.endsWith(".pdf") ||
        lower.endsWith(".docx")
      ) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await extractDocument(fd);
        setContent(result.text);
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
        if (result.warnings.length > 0) {
          setError(result.warnings.join(" · "));
        }
        return;
      }

      setError(
        `Unsupported file type: ${file.type || "unknown"}. Supported: PDF, DOCX, TXT, MD.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    setStreamingPartial(null);
    try {
      const audienceOverrides = selectedPeople; // already the effective list
      const payload = {
        title: title.trim() || "Untitled artifact",
        type,
        rawContent: strategyMode ? "" : content,
        personIds: storedPersonIds,
        objectiveIds: storedObjectiveIds,
        intent: storedIntent.trim() || undefined,
        customer: selectedCustomer,
        research: selectedResearch,
        okrs: selectedOKRs,
        strategyOnly: strategyMode,
        audienceOverrides,
      };

      const result = await runAnalysisStreaming(payload, (partial) => {
        if (mountedRef.current) setStreamingPartial(partial);
      });
      storeResult(result);
      addRecent({
        id: result.id,
        title: result.artifact.title,
        fitScore: result.fitScore,
        personIds: result.artifact.selectedPersonIds,
        objectiveIds: result.artifact.selectedObjectiveIds,
        createdAt: result.createdAt,
      });
      if (mountedRef.current) {
        router.push(`/results/${result.id}`);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError((e as Error).message);
        setSubmitting(false);
      }
    }
  }

  const charCount = content.length;
  const charWarn = charCount > 60_000;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {strategyMode ? "Audience strategy" : "Artifact analyzer"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {strategyMode
            ? "Generate a framing strategy for your selected audience — no artifact required."
            : "Paste or upload your work. Pick the audience. Get sharp recommendations."}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Main */}
        <div className="space-y-5">
          {!strategyMode && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileSearch className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">Your artifact</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q3 Mobile Strategy Memo"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={type}
                    onChange={(e) => setType(e.target.value as ArtifactType)}
                    className="mt-1"
                  >
                    {Object.entries(ARTIFACT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <ModeTab
                  active={mode === "paste"}
                  onClick={() => setMode("paste")}
                  icon={ClipboardPaste}
                  label="Paste"
                />
                <ModeTab
                  active={mode === "upload"}
                  onClick={() => setMode("upload")}
                  icon={Upload}
                  label="Upload"
                />
                <div className="ml-auto text-xs text-muted-foreground self-center">
                  Sample:{" "}
                  {SAMPLE_ARTIFACTS.map((s, i) => (
                    <button
                      key={s.title}
                      onClick={() => {
                        setTitle(s.title);
                        setType(s.type);
                        setContent(s.rawContent);
                        setMode("paste");
                      }}
                      className="text-primary hover:underline mr-2"
                    >
                      {s.label}
                      {i < SAMPLE_ARTIFACTS.length - 1 ? "," : ""}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "paste" ? (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste slide notes, memo content, brief, case study, meeting notes…"
                  className="min-h-[280px] font-mono text-[13px]"
                />
              ) : (
                <FileDrop
                  onFile={handleFile}
                  uploading={uploading}
                  hasContent={content.length > 0}
                  contentPreview={content.slice(0, 240)}
                />
              )}

              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span className={cn(charWarn && "text-warning")}>
                  {charCount.toLocaleString()} characters
                  {charWarn && " · will be truncated to 60,000"}
                </span>
                <span>
                  PDF, DOCX, TXT, MD supported · max 10 MB
                </span>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {storedIntent.trim().length > 0 && (
            <Card className="p-4 border-primary/20 bg-primary/[0.04]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-primary">
                  Your intent
                </div>
                <a
                  href="/audience"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Edit
                </a>
              </div>
              <p className="text-xs leading-relaxed text-foreground/80">
                {storedIntent}
              </p>
            </Card>
          )}
          {selectedCustomer && (
            <Card className="p-4 border-primary/20 bg-primary/[0.04]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-primary">
                  Customer
                </div>
                <a
                  href={`/customers/${selectedCustomer.id}`}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  View
                </a>
              </div>
              <div className="text-sm font-medium">{selectedCustomer.name}</div>
              {selectedCustomer.industry && (
                <div className="text-xs text-muted-foreground">
                  {selectedCustomer.industry}
                </div>
              )}
            </Card>
          )}
          {selectedResearch.length > 0 && (
            <Card className="p-4 border-primary/20 bg-primary/[0.04]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-primary">
                  Research evidence ({selectedResearch.length})
                </div>
                <a
                  href="/audience"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Edit
                </a>
              </div>
              <ul className="space-y-1">
                {selectedResearch.map((r) => (
                  <li key={r.id} className="text-xs leading-snug">
                    <a
                      href={`/research/${r.id}`}
                      className="hover:underline font-medium"
                    >
                      {r.title}
                    </a>
                    <span className="text-muted-foreground"> · {r.source}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {selectedOKRs.length > 0 && (
            <Card className="p-4 border-primary/20 bg-primary/[0.04]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-primary">
                  OKRs ({selectedOKRs.length})
                </div>
                <a
                  href="/audience"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Edit
                </a>
              </div>
              <ul className="space-y-1">
                {selectedOKRs.map((o) => (
                  <li key={o.id} className="text-xs leading-snug">
                    <a
                      href={`/okrs/${o.id}`}
                      className="hover:underline font-medium"
                    >
                      {o.objective}
                    </a>
                    <span className="text-muted-foreground"> · {o.timeframe}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Audience</h3>
            {selectedPeople.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one selected.{" "}
                <a
                  href="/audience"
                  className="text-primary hover:underline"
                >
                  Build an audience
                </a>{" "}
                or pick people below.
              </p>
            ) : (
              <div className="space-y-3 mb-3">
                <div className="flex flex-wrap gap-1.5">
                  {selectedPeople.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePerson(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent border px-2 py-0.5 text-xs hover:bg-muted"
                    >
                      <Avatar name={p.name} size={16} />
                      {p.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <details className="text-sm" open={selectedPeople.length === 0}>
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Pick people
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-64 overflow-auto">
                {INTERNAL_PEOPLE.map((p) => {
                  const sel = storedPersonIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => togglePerson(p.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                          sel ? "bg-primary/[0.06]" : "hover:bg-accent/60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          readOnly
                          className="accent-primary"
                        />
                        <span className="text-sm truncate">{p.name}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground truncate">
                          {p.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Objectives</h3>
            {selectedObjectives.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Optional. Adds strategic framing to the analysis.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedObjectives.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => toggleObjective(o.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-xs hover:bg-primary/15"
                  >
                    {o.title}
                  </button>
                ))}
              </div>
            )}
            <details
              className="text-sm"
              open={selectedPeople.length > 0 && selectedObjectives.length === 0}
            >
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Pick objectives
              </summary>
              <ul className="mt-2 space-y-0.5">
                {OBJECTIVES.map((o) => {
                  const sel = storedObjectiveIds.includes(o.id);
                  return (
                    <li key={o.id}>
                      <button
                        onClick={() => toggleObjective(o.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                          sel ? "bg-primary/[0.06]" : "hover:bg-accent/60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          readOnly
                          className="accent-primary"
                        />
                        <span className="text-sm">{o.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </Card>

          {error && (
            <Card className="p-4 border-danger/30 bg-danger/5">
              <div className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {strategyMode ? "Generate strategy" : "Generate recommendations"}
                </>
              )}
            </Button>
            <div className="text-[11px] text-muted-foreground text-center">
              {process.env.NEXT_PUBLIC_HAS_ANTHROPIC_KEY === "1" ? (
                <>Uses Claude Sonnet 4.6 · prompt caching enabled</>
              ) : (
                <>
                  No <code>ANTHROPIC_API_KEY</code> — running in mock mode (deterministic, profile-grounded)
                </>
              )}
            </div>
            {submitting && (
              <div className="text-[11px] text-muted-foreground text-center">
                Feel free to navigate away — your result will appear in{" "}
                <a href="/" className="underline hover:text-foreground">
                  Recents
                </a>{" "}
                when it&apos;s ready.
              </div>
            )}
            {submitting && streamingPartial && (
              <Card className="p-3 bg-primary/[0.04] border-primary/20 mt-2 space-y-2">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-primary">
                  Live preview
                </div>
                {streamingPartial.tldr && (
                  <p className="text-sm font-medium leading-snug">
                    {streamingPartial.tldr}
                  </p>
                )}
                {typeof streamingPartial.fitScore === "number" && (
                  <div className="text-[11px] text-muted-foreground">
                    Fit so far:{" "}
                    <span className="font-semibold text-foreground">
                      {streamingPartial.fitScore}/100
                    </span>
                  </div>
                )}
                {streamingPartial.dos && streamingPartial.dos.length > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    {streamingPartial.dos.length} Do
                    {streamingPartial.dos.length === 1 ? "" : "'s"} drafted
                    {streamingPartial.donts &&
                      streamingPartial.donts.length > 0 &&
                      ` · ${streamingPartial.donts.length} Don't${streamingPartial.donts.length === 1 ? "" : "s"}`}
                  </div>
                )}
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function FileDrop({
  onFile,
  uploading,
  hasContent,
  contentPreview,
}: {
  onFile: (f: File) => void;
  uploading: boolean;
  hasContent: boolean;
  contentPreview: string;
}) {
  const [drag, setDrag] = useState(false);
  return (
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
        if (f) onFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 min-h-[200px] border-2 border-dashed rounded-lg cursor-pointer transition-colors p-6",
        drag ? "border-primary bg-primary/[0.05]" : "border-border",
      )}
    >
      <input
        type="file"
        accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Upload className="w-6 h-6 text-muted-foreground" />
      <div className="text-sm font-medium">
        {uploading ? "Reading…" : "Drop a file, or click to choose"}
      </div>
      <div className="text-xs text-muted-foreground">
        PDF, DOCX, TXT, or MD · text extraction runs server-side
      </div>
      {hasContent && (
        <div className="mt-3 w-full max-w-md text-xs text-foreground/70 bg-muted/60 p-2 rounded font-mono line-clamp-3">
          {contentPreview}…
        </div>
      )}
    </label>
  );
}

// Streams the analyze endpoint via NDJSON. Parses each line as a JSON event
// and dispatches partial updates to the caller. Resolves with the final
// RecommendationResult once the server emits a "complete" event.
async function runAnalysisStreaming(
  payload: AnalyzeInput,
  onPartial: (partial: PartialRecommendation) => void,
): Promise<RecommendationResult> {
  const res = await fetch("/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream request failed (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final: RecommendationResult | null = null;
  let errorMsg: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line) as
          | { type: "partial"; partial: PartialRecommendation }
          | { type: "complete"; result: RecommendationResult }
          | { type: "error"; message: string };
        if (evt.type === "partial") onPartial(evt.partial);
        else if (evt.type === "complete") final = evt.result;
        else if (evt.type === "error") errorMsg = evt.message;
      } catch {
        // skip malformed line — server side controls the format
      }
    }
    if (done) break;
  }

  if (errorMsg) throw new Error(errorMsg);
  if (!final) throw new Error("Stream ended without a complete result.");
  return final;
}
