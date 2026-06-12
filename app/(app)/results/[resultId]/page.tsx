"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Download,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Eye,
  Target,
  Users,
  ChevronDown,
  Compass,
  ThumbsUp,
  ThumbsDown,
  Building2,
  ShieldAlert,
  BookOpen,
  Flag,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ARTIFACT_TYPE_LABELS, type RecommendationResult } from "@/lib/types";

interface Props {
  params: Promise<{ resultId: string }>;
}

export default function ResultsPage({ params }: Props) {
  const { resultId } = use(params);
  const result = useProfilerStore((s) => s.results[resultId]);
  const depth = useProfilerStore((s) => s.resultsDepth) ?? 3;
  const setDepth = useProfilerStore((s) => s.setResultsDepth);
  const ALL_PEOPLE = useEffectivePeople();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  // Keyboard shortcuts:
  //   1-4 → depth level
  //   c   → copy share-ready (TL;DR + Do's + Don'ts) to clipboard
  useEffect(() => {
    if (!result) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!result) return;
      if (e.key >= "1" && e.key <= "4") {
        setDepth(Number(e.key) as 1 | 2 | 3 | 4);
      } else if (e.key.toLowerCase() === "c") {
        navigator.clipboard.writeText(buildShareableText(result, ALL_PEOPLE));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, setDepth, ALL_PEOPLE]);

  if (!hydrated) {
    return <ResultsSkeleton />;
  }
  if (!result) {
    // The result may have been generated in another tab / been cleared.
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Result not found</h1>
        <p className="text-muted-foreground mt-2">
          This recommendation isn't in your local store. It may have been
          generated in another browser or cleared.
        </p>
        <div className="mt-6">
          <Link href="/analyze">
            <Button>Run a new analysis</Button>
          </Link>
        </div>
      </div>
    );
  }

  const people = ALL_PEOPLE.filter((p) =>
    result.artifact.selectedPersonIds.includes(p.id),
  );
  const objectives = OBJECTIVES.filter((o) =>
    result.artifact.selectedObjectiveIds.includes(o.id),
  );

  const fitTone =
    result.fitScore >= 70
      ? "success"
      : result.fitScore >= 45
        ? "warning"
        : "danger";

  return (
    <div>
      <Link
        href="/analyze"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to analyzer
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Badge tone="subtle">
              {ARTIFACT_TYPE_LABELS[result.artifact.type]}
            </Badge>
            <Badge tone={result.generatedBy === "anthropic" ? "primary" : "neutral"}>
              {result.generatedBy === "anthropic"
                ? `Claude ${result.model ?? ""}`
                : "Mock mode"}
            </Badge>
            <span>
              {new Date(result.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {result.artifact.title}
          </h1>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex -space-x-2">
                {people.slice(0, 5).map((p) => (
                  <div key={p.id} className="ring-2 ring-background rounded-full">
                    <Avatar name={p.name} size={26} />
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-1">
                {people.map((p) => p.name.split(" ")[0]).join(", ")}
              </span>
            </div>
            {objectives.length > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {objectives.map((o) => o.title).join(", ")}
                  </span>
                </div>
              </>
            )}
            {result.artifact.customer && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/customers/${result.artifact.customer.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {result.artifact.customer.name}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <FitGauge score={result.fitScore} tone={fitTone} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/results/${result.id}/delta`)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            What if?
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/analyze")}
          >
            <RotateCw className="w-3.5 h-3.5" />
            Re-run
          </Button>
        </div>
      </header>

      <DepthControl value={depth} onChange={setDepth} />

      {result.artifact.intent && (
        <Card className="p-4 mb-4 border-dashed">
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Your intent
            </span>
          </div>
          <p className="text-sm leading-relaxed">{result.artifact.intent}</p>
        </Card>
      )}

      {result.tldr && (
        <Card className="p-5 mb-4 border-primary/25 bg-primary/[0.04]">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[11px] uppercase tracking-wide font-semibold text-primary">
                TL;DR
              </span>
              {result.generatedBy === "mock" && (
                <Badge tone="neutral" className="text-[10px]">
                  Heuristic — no Claude key
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ShareableCopyButton result={result} />
              <CopyButton text={result.tldr} label="TL;DR" />
            </div>
          </div>
          <p className="text-lg leading-snug font-medium">{result.tldr}</p>
        </Card>
      )}

      {depth >= 2 && (
        <Section
          icon={Sparkles}
          title="Executive summary"
          copyText={result.summary}
        >
          <p className="text-base leading-relaxed">{result.summary}</p>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3">
            <span>
              Confidence: <span className="text-foreground">{result.confidence}</span>
            </span>
          </div>
        </Section>
      )}

      {depth >= 3 && (
        <Section icon={Eye} title="How this audience will read it">
          <p className="leading-relaxed">{result.audienceRead}</p>
        </Section>
      )}

      {depth >= 2 && (
        <Section icon={AlertTriangle} title="Key risks">
          <ul className="space-y-2.5">
            {result.keyRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <SeverityChip severity={r.severity} />
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">{r.risk}</p>
                  {r.tiedTo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tied to:{" "}
                      <span className="text-foreground/80">{r.tiedTo}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {depth >= 2 &&
        result.researchEvidence &&
        result.researchEvidence.length > 0 && (
          <Section
            icon={BookOpen}
            title="Research evidence"
            subtitle="Primary-source findings backing this recommendation"
          >
            <ul className="space-y-3">
              {result.researchEvidence.map((c, i) => (
                <ResearchCitationRow key={i} citation={c} />
              ))}
            </ul>
          </Section>
        )}

      {depth >= 2 &&
        result.okrAlignment &&
        result.okrAlignment.length > 0 && (
          <Section
            icon={Flag}
            title="OKR alignment"
            subtitle="How this recommendation advances your stated goals"
          >
            <ul className="space-y-3">
              {result.okrAlignment.map((a, i) => (
                <OKRAlignmentRow key={i} note={a} />
              ))}
            </ul>
          </Section>
        )}

      {depth >= 3 && (
        <Section icon={Compass} title="Recommended framing">
          <p className="leading-relaxed">{result.recommendedFraming}</p>
        </Section>
      )}

      {depth >= 4 && result.tacticalEdits.length > 0 && (
        <Section title="Tactical edits" subtitle="Specific changes, with before / after">
          <div className="space-y-3">
            {result.tacticalEdits.map((edit, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge tone="primary">{edit.location}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {edit.issue}
                  </span>
                </div>
                {edit.before && (
                  <div className="mb-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1 flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-danger" />
                      Before
                    </div>
                    <div className="text-sm leading-relaxed bg-danger/[0.04] border border-danger/15 rounded-md p-2.5 whitespace-pre-wrap">
                      {edit.before}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    After
                  </div>
                  <div className="text-sm leading-relaxed bg-success/[0.04] border border-success/15 rounded-md p-2.5 whitespace-pre-wrap">
                    {edit.after}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {edit.rationale}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {depth >= 4 && (
        <Section title="Narrative structure">
          <ol className="space-y-2">
            {result.narrativeStructure.map((beat, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-medium text-xs inline-flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="leading-relaxed pt-0.5">{beat}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Section title="Do's" icon={CheckCircle2} inline>
          <ul className="space-y-2">
            {(result.dos ?? []).map((e, i) => (
              <li key={i} className="text-sm flex gap-2 leading-relaxed">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-[3px]" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Don'ts" icon={XCircle} inline>
          <ul className="space-y-2">
            {(result.donts ?? []).map((e, i) => (
              <li key={i} className="text-sm flex gap-2 leading-relaxed">
                <XCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-[3px]" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {depth >= 3 && result.practiceQA && result.practiceQA.length > 0 && (
        <Section
          icon={ShieldAlert}
          title="Practice Q&amp;A"
          subtitle="The hardest questions this audience will ask"
        >
          <ul className="space-y-3">
            {result.practiceQA.map((qa, i) => (
              <li key={i} className="rounded-md border p-4 bg-surface/40">
                <div className="flex items-start gap-3 mb-2">
                  <SeverityChip severity={qa.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug">{qa.question}</p>
                    {qa.askedBy && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Likely from{" "}
                        <span className="text-foreground/80">{qa.askedBy}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 pl-[44px]">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Recommended answer
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {qa.answer}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {depth >= 3 && result.meetingApproach && (
        <Section title="Meeting / readout approach" icon={Users}>
          <p className="leading-relaxed">{result.meetingApproach}</p>
        </Section>
      )}

      {depth >= 4 && result.revisedArtifact && (
        <RevisedSection
          markdown={result.revisedArtifact}
          original={result.artifact.rawContent}
        />
      )}

      <FeedbackSection resultId={result.id} feedback={result.feedback} />

      <div className="text-center text-xs text-muted-foreground py-8">
        Generated {result.generatedBy === "anthropic" ? "by Claude" : "in mock mode"}
        {result.model ? ` · ${result.model}` : ""} · {new Date(result.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

function FeedbackSection({
  resultId,
  feedback,
}: {
  resultId: string;
  feedback?: { rating: "positive" | "negative"; notes?: string; createdAt: string };
}) {
  const setFeedback = useProfilerStore((s) => s.setResultFeedback);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(feedback?.notes ?? "");

  function pick(rating: "positive" | "negative") {
    if (feedback?.rating === rating) {
      setFeedback(resultId, null);
      setNotesOpen(false);
      setNotes("");
      return;
    }
    setFeedback(resultId, {
      rating,
      notes: feedback?.notes,
      createdAt: new Date().toISOString(),
    });
    setNotesOpen(true);
  }

  function saveNotes() {
    if (!feedback) return;
    setFeedback(resultId, { ...feedback, notes: notes.trim() || undefined });
    setNotesOpen(false);
  }

  return (
    <Card className="p-4 mb-4 border-dashed">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-medium">Did this land?</span>{" "}
          <span className="text-muted-foreground">
            Feedback improves future recommendations for this audience.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pick("positive")}
            className={cn(
              "inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border transition-colors",
              feedback?.rating === "positive"
                ? "bg-success/15 border-success/40 text-success"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Helpful
          </button>
          <button
            onClick={() => pick("negative")}
            className={cn(
              "inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border transition-colors",
              feedback?.rating === "negative"
                ? "bg-danger/10 border-danger/40 text-danger"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            Off
          </button>
        </div>
      </div>
      {feedback && (notesOpen || feedback.notes) && (
        <div className="mt-3">
          {notesOpen ? (
            <div className="flex gap-2 items-start">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  feedback.rating === "positive"
                    ? "What worked? (Optional — helps us tune the recommendation.)"
                    : "What was off? Which person did it miss?"
                }
                className="flex-1 text-sm rounded-md border bg-background px-3 py-2 min-h-[64px]"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={saveNotes}>
                  Save
                </Button>
                <button
                  onClick={() => {
                    setNotes(feedback.notes ?? "");
                    setNotesOpen(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNotesOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground italic text-left"
            >
              {feedback.notes ? `"${feedback.notes}"` : "+ Add a note"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function ResearchCitationRow({
  citation,
}: {
  citation: import("@/lib/types").ResearchCitation;
}) {
  const research = useProfilerStore((s) => s.documents?.[citation.researchId]);
  return (
    <li className="rounded-md border p-4 bg-surface/40">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-sm font-semibold flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          {research ? (
            <Link
              href={`/documents/${research.id}`}
              className="hover:underline truncate"
            >
              {research.title}
            </Link>
          ) : (
            <span className="text-muted-foreground italic">
              Research not in local store ({citation.researchId})
            </span>
          )}
        </div>
        {research?.source && (
          <span className="text-[11px] text-muted-foreground">
            {research.source}
          </span>
        )}
      </div>
      <blockquote className="text-sm border-l-2 border-primary/40 pl-3 italic leading-relaxed text-foreground/90">
        {citation.finding}
      </blockquote>
      <div className="text-[11px] text-muted-foreground mt-2">
        Applies to: <span className="font-mono">{citation.appliedTo}</span>
      </div>
    </li>
  );
}

function OKRAlignmentRow({
  note,
}: {
  note: import("@/lib/types").OKRAlignmentNote;
}) {
  const okr = useProfilerStore((s) => s.okrs?.[note.okrId]);
  const bu = useProfilerStore((s) =>
    okr?.businessUnitId ? s.businessUnits?.[okr.businessUnitId] : undefined,
  );
  const tone =
    note.alignment === "advances"
      ? "success"
      : note.alignment === "tension"
        ? "danger"
        : "subtle";
  const label =
    note.alignment === "advances"
      ? "Advances"
      : note.alignment === "tension"
        ? "Tension"
        : "Neutral";
  return (
    <li className="rounded-md border p-4 bg-surface/40">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="text-sm font-semibold flex items-center gap-2 min-w-0">
          <Flag className="w-3.5 h-3.5 text-primary shrink-0" />
          {okr ? (
            <Link href={`/okrs/${okr.id}`} className="hover:underline">
              {okr.objective}
            </Link>
          ) : (
            <span className="text-muted-foreground italic">
              OKR not in local store ({note.okrId})
            </span>
          )}
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {okr && (
        <div className="text-[11px] text-muted-foreground mb-2">
          {okr.level === "company" ? "Company" : bu?.name ?? "BU"} · {okr.timeframe}
        </div>
      )}
      <p className="text-sm leading-relaxed">{note.advancesHow}</p>
    </li>
  );
}

function buildShareableText(
  result: RecommendationResult,
  people: { id: string; name: string }[],
): string {
  const audience =
    people
      .filter((p) => result.artifact.selectedPersonIds.includes(p.id))
      .map((p) => p.name.split(" ")[0])
      .join(", ") || "audience";
  const lines: string[] = [];
  lines.push(`*${result.artifact.title}* — for ${audience} (fit ${result.fitScore}/100)`);
  lines.push("");
  lines.push(`*TL;DR:* ${result.tldr}`);
  if (result.dos?.length) {
    lines.push("");
    lines.push("*Do:*");
    for (const d of result.dos) lines.push(`• ${d}`);
  }
  if (result.donts?.length) {
    lines.push("");
    lines.push("*Don't:*");
    for (const d of result.donts) lines.push(`• ${d}`);
  }
  return lines.join("\n");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : `Copy ${label}`}
    </button>
  );
}

function ShareableCopyButton({ result }: { result: RecommendationResult }) {
  const [copied, setCopied] = useState(false);
  const people = useEffectivePeople();
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(buildShareableText(result, people));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-medium inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1 hover:opacity-90"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Copied" : "Copy for Slack"}
    </button>
  );
}

const DEPTH_LEVELS: { value: 1 | 2 | 3 | 4; label: string; hint: string }[] = [
  { value: 1, label: "Glance", hint: "TL;DR + Do's / Don'ts" },
  { value: 2, label: "Brief", hint: "+ summary, risks, research, OKRs" },
  { value: 3, label: "Standard", hint: "+ audience read, framing, practice Q&A, meeting" },
  { value: 4, label: "Full", hint: "+ tactical edits, narrative, revised artifact" },
];

function DepthControl({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | 4;
  onChange: (d: 1 | 2 | 3 | 4) => void;
}) {
  const current = DEPTH_LEVELS.find((l) => l.value === value);
  return (
    <div className="mb-4 px-3 py-2.5 rounded-lg border bg-surface flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
          Detail
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {current?.hint}
        </span>
        <span className="hidden sm:inline text-[10px] text-muted-foreground/70 font-mono ml-1">
          1-4 to switch · c to copy
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Detail level"
        className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5"
      >
        {DEPTH_LEVELS.map((l) => {
          const active = l.value === value;
          return (
            <button
              key={l.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(l.value)}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  copyText,
  inline = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  copyText?: string;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className={cn("p-5 mb-4", inline && "h-full")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {subtitle && (
            <span className="text-xs text-muted-foreground ml-1">
              · {subtitle}
            </span>
          )}
        </div>
        {copyText && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

function SeverityChip({ severity }: { severity: "low" | "med" | "high" }) {
  const tone =
    severity === "high" ? "danger" : severity === "med" ? "warning" : "subtle";
  const label =
    severity === "high" ? "High" : severity === "med" ? "Med" : "Low";
  return (
    <Badge tone={tone} className="mt-0.5 shrink-0">
      {label}
    </Badge>
  );
}

function FitGauge({
  score,
  tone,
}: {
  score: number;
  tone: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success" ? "#16a34a" : tone === "warning" ? "#d97706" : "#dc2626";
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-2">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 70 70" className="w-16 h-16">
          <circle
            cx="35"
            cy="35"
            r={r}
            stroke="var(--muted)"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="35"
            cy="35"
            r={r}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-semibold text-lg">
          {score}
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Audience fit
        </div>
        <div className="text-sm font-medium">
          {score >= 70 ? "Strong" : score >= 45 ? "Mixed" : "Weak"}
        </div>
      </div>
    </div>
  );
}

type RevisedView = "revised" | "side-by-side" | "diff";

function RevisedSection({
  markdown,
  original,
}: {
  markdown: string;
  original?: string;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<RevisedView>("revised");
  const hasOriginal = !!original && original.trim().length > 0;

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revised-artifact.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <h2 className="font-semibold tracking-tight">Revised artifact</h2>
          <span className="text-xs text-muted-foreground">
            · markdown · use as a scaffold
          </span>
        </button>
        <div className="flex items-center gap-3">
          {hasOriginal && open && (
            <div
              role="radiogroup"
              aria-label="Revised view mode"
              className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5"
            >
              {(
                [
                  { v: "revised", label: "Revised" },
                  { v: "side-by-side", label: "Side-by-side" },
                  { v: "diff", label: "Diff" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  role="radio"
                  aria-checked={view === opt.v}
                  onClick={() => setView(opt.v)}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded transition-colors",
                    view === opt.v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={download}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              .md
            </button>
          </div>
        </div>
      </div>
      {open && (
        <>
          {view === "revised" || !hasOriginal ? (
            <div className="prose-memo max-w-none border-t pt-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          ) : view === "side-by-side" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-5">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-danger" />
                  Original
                </div>
                <pre className="text-[12px] font-mono whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-[600px] overflow-auto">
                  {original}
                </pre>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  Revised
                </div>
                <div className="prose-memo max-w-none bg-success/[0.03] rounded-md p-3 max-h-[600px] overflow-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <DiffView original={original!} revised={markdown} />
          )}
        </>
      )}
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-2/3 mb-6" />
      <div className="skeleton h-32" />
      <div className="skeleton h-24" />
      <div className="skeleton h-40" />
    </div>
  );
}

// Line-based LCS diff. Returns an ordered list of segments labelled as
// "keep", "add" (only in revised), or "remove" (only in original). Markdown
// is line-oriented enough that this gives readable diffs without a dep.
function lineDiff(
  a: string,
  b: string,
): { kind: "keep" | "add" | "remove"; text: string }[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;
  // Build LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { kind: "keep" | "add" | "remove"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: "keep", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "remove", text: A[i] });
      i++;
    } else {
      out.push({ kind: "add", text: B[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "remove", text: A[i++] });
  while (j < m) out.push({ kind: "add", text: B[j++] });
  return out;
}

function DiffView({ original, revised }: { original: string; revised: string }) {
  const segments = useMemo(() => lineDiff(original, revised), [original, revised]);
  return (
    <div className="border-t pt-5">
      <div className="text-xs text-muted-foreground mb-2">
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-2 h-2 rounded-sm bg-success/40" /> added
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-danger/40" /> removed
        </span>
      </div>
      <pre className="text-[12px] font-mono whitespace-pre-wrap rounded-md border bg-muted/20 p-3 max-h-[600px] overflow-auto">
        {segments.map((s, i) => (
          <div
            key={i}
            className={cn(
              "px-2 -mx-2 leading-relaxed",
              s.kind === "add" && "bg-success/[0.12] text-success-foreground",
              s.kind === "remove" && "bg-danger/[0.12] line-through opacity-80",
            )}
          >
            <span className="select-none text-muted-foreground mr-2">
              {s.kind === "add" ? "+" : s.kind === "remove" ? "−" : " "}
            </span>
            {s.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
