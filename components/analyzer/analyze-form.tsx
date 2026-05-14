"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileSearch,
  Sparkles,
  Upload,
  ClipboardPaste,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import { useProfilerStore } from "@/lib/store";
import { runAnalysis } from "@/app/actions";
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
  const storedPersonIds = useProfilerStore((s) => s.selectedPersonIds);
  const storedObjectiveIds = useProfilerStore((s) => s.selectedObjectiveIds);
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

  const selectedPeople = useMemo(
    () => PEOPLE.filter((p) => storedPersonIds.includes(p.id)),
    [storedPersonIds],
  );
  const selectedObjectives = useMemo(
    () => OBJECTIVES.filter((o) => storedObjectiveIds.includes(o.id)),
    [storedObjectiveIds],
  );

  const canSubmit =
    selectedPeople.length > 0 &&
    title.trim().length > 0 &&
    (strategyMode || content.trim().length > 0) &&
    !submitting;

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (
        file.type.startsWith("text/") ||
        /\.(md|txt|markdown)$/i.test(file.name)
      ) {
        const text = await file.text();
        setContent(text);
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      } else {
        setError(
          "Only text and markdown are supported in this prototype. Paste content instead.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await runAnalysis({
        title: title.trim() || "Untitled artifact",
        type,
        rawContent: strategyMode ? "" : content,
        personIds: storedPersonIds,
        objectiveIds: storedObjectiveIds,
        strategyOnly: strategyMode,
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
      router.push(`/results/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
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
                  Prototype supports text & markdown upload. PDF/DOCX coming.
                </span>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
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

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Pick people
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-64 overflow-auto">
                {PEOPLE.map((p) => {
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
            <details className="text-sm">
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
        accept=".txt,.md,.markdown,text/plain,text/markdown"
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
        Text & markdown supported in this prototype
      </div>
      {hasContent && (
        <div className="mt-3 w-full max-w-md text-xs text-foreground/70 bg-muted/60 p-2 rounded font-mono line-clamp-3">
          {contentPreview}…
        </div>
      )}
    </label>
  );
}
