"use client";
import { use, useEffect, useState } from "react";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProfilerStore } from "@/lib/store";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ARTIFACT_TYPE_LABELS } from "@/lib/types";

interface Props {
  params: Promise<{ resultId: string }>;
}

export default function ResultsPage({ params }: Props) {
  const { resultId } = use(params);
  const result = useProfilerStore((s) => s.results[resultId]);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

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

  const people = PEOPLE.filter((p) =>
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
    <div className="max-w-6xl mx-auto">
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
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FitGauge score={result.fitScore} tone={fitTone} />
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

      <Section icon={Eye} title="How this audience will read it">
        <p className="leading-relaxed">{result.audienceRead}</p>
      </Section>

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

      <Section icon={Compass} title="Recommended framing">
        <p className="leading-relaxed">{result.recommendedFraming}</p>
      </Section>

      {result.tacticalEdits.length > 0 && (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Section title="Emphasize" inline>
          <ul className="space-y-1.5">
            {result.emphasize.map((e, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-success">+</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Avoid" inline>
          <ul className="space-y-1.5">
            {result.avoid.map((e, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-danger">−</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {result.meetingApproach && (
        <Section title="Meeting / readout approach" icon={Users}>
          <p className="leading-relaxed">{result.meetingApproach}</p>
        </Section>
      )}

      {result.revisedArtifact && (
        <RevisedSection markdown={result.revisedArtifact} />
      )}

      <div className="text-center text-xs text-muted-foreground py-8">
        Generated {result.generatedBy === "anthropic" ? "by Claude" : "in mock mode"}
        {result.model ? ` · ${result.model}` : ""} · {new Date(result.createdAt).toLocaleString()}
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

function RevisedSection({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

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
      <div className="flex items-center justify-between mb-3">
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
      {open && (
        <div className="prose-memo max-w-none border-t pt-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      )}
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="skeleton h-8 w-2/3 mb-6" />
      <div className="skeleton h-32" />
      <div className="skeleton h-24" />
      <div className="skeleton h-40" />
    </div>
  );
}
