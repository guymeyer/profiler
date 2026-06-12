"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Layers,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { SYNTHESIS_LENSES, type Synthesis } from "@/lib/types";
import { documentToResearch, documentToPRD } from "@/lib/document-adapters";
import type { PRDDocument, ResearchDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function NewSynthesisPage() {
  const router = useRouter();
  const documents = useProfilerStore((s) => s.documents ?? {});
  const saveSynthesis = useProfilerStore((s) => s.saveSynthesis);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [selectedResearchIds, setSelectedResearchIds] = useState<string[]>([]);
  const [selectedPrdIds, setSelectedPrdIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useEffectivePeople();

  const researchList = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.kind === "research")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents],
  );
  const prdList = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.kind === "prd")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents],
  );

  const toggle = (id: string) =>
    setSelectedResearchIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const togglePrd = (id: string) =>
    setSelectedPrdIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const togglePerson = (id: string) =>
    setSelectedPersonIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const canGenerate =
    (selectedResearchIds.length + selectedPrdIds.length >= 1) && !generating;

  async function handleGenerate() {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    try {
      const selected = selectedResearchIds
        .map((id) => documents[id])
        .filter((d): d is ResearchDocument => d?.kind === "research")
        .map(documentToResearch);
      const selectedPrds = selectedPrdIds
        .map((id) => documents[id])
        .filter((d): d is PRDDocument => d?.kind === "prd")
        .map(documentToPRD);
      const selectedPeople = selectedPersonIds
        .map((id) => people.find((p) => p.id === id))
        .filter(Boolean);
      const res = await fetch("/api/synthesis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          research: selected,
          prds: selectedPrds,
          people: selectedPeople,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${res.status}).`);
      }
      const { synthesis } = (await res.json()) as { synthesis: Synthesis };
      saveSynthesis(synthesis);
      router.push(`/synthesis/${synthesis.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  return (
    <div>
      <Link
        href="/synthesis"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All syntheses
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5" />
          New synthesis
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Pick the research reports to synthesize. The output is a microsite
          with a built-in lens dropdown — viewers switch between a general
          read and reads for {SYNTHESIS_LENSES.length - 1} common enterprise
          organizations without regenerating.
        </p>
      </header>

      {!hydrated ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">
                  Research reports
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    {selectedResearchIds.length} selected
                  </span>
                </h2>
              </div>
              {researchList.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  No research yet —{" "}
                  <Link
                    href="/research/new"
                    className="text-primary hover:underline"
                  >
                    add some first
                  </Link>
                  .
                </div>
              ) : (
                <ul className="divide-y">
                  {researchList.map((r) => {
                    const checked = selectedResearchIds.includes(r.id);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          className={cn(
                            "w-full text-left py-3 flex items-start gap-3 transition-colors",
                            checked ? "bg-accent/40" : "hover:bg-accent/30",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border mt-0.5 shrink-0 inline-flex items-center justify-center",
                              checked
                                ? "bg-primary border-primary"
                                : "border-border",
                            )}
                          >
                            {checked && (
                              <svg
                                className="w-3 h-3 text-primary-foreground"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
                                <path
                                  d="M3 8.5l3 3 7-7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-tight">
                              {r.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {r.source}
                              {r.kind === "research" &&
                                r.properties.conductedAt &&
                                ` · ${new Date(r.properties.conductedAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`}
                            </div>
                            <p className="text-sm text-foreground/80 line-clamp-2 mt-1">
                              {r.summary}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">
                  PRDs (planned intent)
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    {selectedPrdIds.length} selected · optional
                  </span>
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Fold PRDs in as planned intent alongside research observations.
                The synthesis surfaces where intent and observation align vs.
                diverge.
              </p>
              {prdList.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  No PRDs in the library yet —{" "}
                  <Link
                    href="/prds/new"
                    className="text-primary hover:underline"
                  >
                    add one
                  </Link>{" "}
                  or skip this section.
                </div>
              ) : (
                <ul className="divide-y">
                  {prdList.map((p) => {
                    const checked = selectedPrdIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => togglePrd(p.id)}
                          className={cn(
                            "w-full text-left py-3 flex items-start gap-3 transition-colors",
                            checked ? "bg-accent/40" : "hover:bg-accent/30",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border mt-0.5 shrink-0 inline-flex items-center justify-center",
                              checked
                                ? "bg-primary border-primary"
                                : "border-border",
                            )}
                          >
                            {checked && (
                              <svg
                                className="w-3 h-3 text-primary-foreground"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
                                <path
                                  d="M3 8.5l3 3 7-7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-tight">
                              {p.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {p.source ?? "Owner unknown"}
                              {p.kind === "prd" && ` · ${p.properties.status}`}
                              {p.kind === "prd" && p.properties.targetShipDate &&
                                ` · ship ${new Date(p.properties.targetShipDate).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`}
                            </div>
                            <p className="text-sm text-foreground/80 line-clamp-2 mt-1">
                              {p.summary}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-3">Functional lenses included</h2>
              <p className="text-xs text-muted-foreground mb-3">
                The microsite always includes these lenses. Viewers switch via
                the sidebar without regenerating.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SYNTHESIS_LENSES.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="font-medium text-sm">{l.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.brief}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">
                  Person lenses
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    {selectedPersonIds.length} selected · optional
                  </span>
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                A microscopic reframe per named individual using their full
                profile. Each person lens has a Full brief / Executive summary
                toggle. Skip if you don&apos;t need stakeholder-specific reads.
              </p>
              {people.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  No people in the directory yet —{" "}
                  <Link
                    href="/people"
                    className="text-primary hover:underline"
                  >
                    add some first
                  </Link>
                  .
                </div>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[360px] overflow-auto pr-1">
                  {people.map((p) => {
                    const checked = selectedPersonIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => togglePerson(p.id)}
                          className={cn(
                            "w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors",
                            checked
                              ? "bg-accent/60"
                              : "hover:bg-accent/30",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border mt-0.5 shrink-0 inline-flex items-center justify-center",
                              checked
                                ? "bg-primary border-primary"
                                : "border-border",
                            )}
                          >
                            {checked && (
                              <svg
                                className="w-3 h-3 text-primary-foreground"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
                                <path
                                  d="M3 8.5l3 3 7-7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <Avatar name={p.name} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {p.title}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-3">
                Title{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  optional
                </span>
              </h2>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </Card>
          </div>

          <aside className="lg:sticky lg:top-20">
            <Card className="p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Ready to generate
              </h2>
              <div className="space-y-3 text-sm">
                <Row
                  label="Documents"
                  value={
                    selectedResearchIds.length + selectedPrdIds.length === 0
                      ? "Pick at least one"
                      : `${selectedResearchIds.length} research · ${selectedPrdIds.length} PRD`
                  }
                  ok={selectedResearchIds.length + selectedPrdIds.length > 0}
                />
                <Row
                  label="Lenses"
                  value={`${SYNTHESIS_LENSES.length} functional${
                    selectedPersonIds.length > 0
                      ? ` + ${selectedPersonIds.length} person`
                      : ""
                  }`}
                  ok
                />
              </div>
              {error && (
                <div className="mt-3 text-sm text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <Button
                className="w-full mt-4"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Synthesizing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate microsite
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Generation usually takes 60–180 seconds — all lenses are
                produced in one pass.
              </p>
              {selectedResearchIds.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-[11px] text-muted-foreground mb-1.5">
                    Selected reports
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedResearchIds.slice(0, 6).map((id) => (
                      <Badge
                        key={id}
                        tone="subtle"
                        className="text-[10px] max-w-[180px] truncate"
                      >
                        {documents[id]?.title}
                      </Badge>
                    ))}
                    {selectedResearchIds.length > 6 && (
                      <Badge tone="subtle" className="text-[10px]">
                        +{selectedResearchIds.length - 6}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right",
          ok ? "text-foreground" : "text-muted-foreground italic",
        )}
      >
        {value}
      </span>
    </div>
  );
}
