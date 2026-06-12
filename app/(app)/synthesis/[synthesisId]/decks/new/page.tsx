"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Presentation,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudienceSelector } from "@/components/audience-selector";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import type { DeckAudience, SlideDeck } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ synthesisId: string }>;
}

export default function NewDeckPage({ params }: Props) {
  const { synthesisId } = use(params);
  const router = useRouter();
  const synthesis = useProfilerStore((s) => s.syntheses?.[synthesisId]);
  const saveDeck = useProfilerStore((s) => s.saveDeck);
  const people = useEffectivePeople();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [audience, setAudience] = useState<DeckAudience>({
    personIds: [],
    objectiveIds: [],
    intent: "",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hydrated && !synthesis) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Synthesis not found</h1>
        <div className="mt-6">
          <Link href="/synthesis">
            <Button>Back to syntheses</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!hydrated || !synthesis) return null;

  const canGenerate =
    !generating &&
    (audience.personIds.length > 0 || audience.objectiveIds.length > 0);

  async function handleGenerate() {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    try {
      const audiencePeople = people.filter((p) =>
        audience.personIds.includes(p.id),
      );
      const audienceObjectives = OBJECTIVES.filter((o) =>
        audience.objectiveIds.includes(o.id),
      );
      const res = await fetch("/api/synthesis/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synthesis,
          audience,
          audiencePeople,
          audienceObjectives,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${res.status}).`);
      }
      const { deck } = (await res.json()) as { deck: SlideDeck };
      saveDeck(deck);
      router.push(`/synthesis/${synthesis.id}/decks/${deck.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  return (
    <div>
      <Link
        href={`/synthesis/${synthesis.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to synthesis
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">
            {synthesis.title}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Presentation className="w-5 h-5" />
          New deck
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Compress this synthesis into a slide deck shaped for a specific room.
          The audience drives what to lead with, what to compress, and what
          call-to-action lands at the end.
        </p>
      </header>

      <StepIndicator step={1} />

      <div className="mt-6">
        <AudienceSelector
          people={people}
          objectives={OBJECTIVES}
          value={audience}
          onChange={setAudience}
        />
      </div>

      <Card className="p-5 mt-6 sticky bottom-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {!canGenerate
              ? "Pick at least one person or one objective to continue."
              : "Ready to compress this synthesis into a deck."}
          </div>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate deck
              </>
            )}
          </Button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </Card>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Audience" },
    { n: 2, label: "Generate" },
    { n: 3, label: "Present" },
  ];
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const state =
          s.n < step ? "done" : s.n === step ? "active" : "pending";
        return (
          <div key={s.n} className="flex items-center gap-3">
            <div
              className={cn(
                "w-6 h-6 rounded-full border inline-flex items-center justify-center text-[11px] font-semibold",
                state === "done" &&
                  "bg-primary border-primary text-primary-foreground",
                state === "active" &&
                  "border-primary text-primary bg-primary/10",
                state === "pending" && "border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="w-3 h-3" /> : s.n}
            </div>
            <span
              className={cn(
                "text-sm",
                state === "active"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="w-8 h-px bg-border mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}
