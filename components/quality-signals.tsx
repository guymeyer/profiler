"use client";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useProfilerStore } from "@/lib/store";

// Lightweight "how load-bearing is this" signal for a Knowledge artifact.
// Counts citations in syntheses + decks + bu recommendations, all derived
// from the existing store state. No telemetry, no events — just graph
// traversal at render time.

interface Props {
  artifactKind: "research" | "prd" | "memo";
  artifactId: string;
  artifactTitle: string;
  className?: string;
}

export function QualitySignals({
  artifactKind,
  artifactId,
  artifactTitle,
  className,
}: Props) {
  const syntheses = useProfilerStore((s) => s.syntheses ?? {});
  const decks = useProfilerStore((s) => s.decks ?? {});
  const recs = useProfilerStore((s) => s.buRecommendations ?? {});
  const metrics = useProfilerStore((s) => s.metrics ?? {});

  const signals = useMemo(() => {
    const out: { label: string; count: number; hint?: string }[] = [];

    // Syntheses that include this research as a source. Synthesis only
    // sources research today, so this is empty for PRDs and memos.
    if (artifactKind === "research") {
      const synthesisCount = Object.values(syntheses).filter((s) =>
        s.researchIds.includes(artifactId),
      ).length;
      if (synthesisCount > 0) {
        out.push({
          label: `cited in ${synthesisCount} synthes${synthesisCount === 1 ? "is" : "es"}`,
          count: synthesisCount,
          hint: "Used as source material in a multi-lens synthesis",
        });
      }
    }

    // Decks compress syntheses, so cite-by-deck is transitive. Count decks
    // whose synthesis includes this artifact (research only).
    if (artifactKind === "research") {
      const includingDecks = new Set<string>();
      for (const d of Object.values(decks)) {
        const s = syntheses[d.synthesisId];
        if (s && s.researchIds.includes(artifactId)) includingDecks.add(d.id);
      }
      if (includingDecks.size > 0) {
        out.push({
          label: `present in ${includingDecks.size} deck${includingDecks.size === 1 ? "" : "s"}`,
          count: includingDecks.size,
          hint: "Surfaces in a presentation derived from a synthesis",
        });
      }
    }

    // BU recommendations that cite this artifact (research only — the rec
    // schema today records research ids on its researchCitations).
    if (artifactKind === "research") {
      let recCount = 0;
      for (const r of Object.values(recs)) {
        for (const rec of r.recommendations) {
          if (
            rec.researchCitations.some((c) => c.researchId === artifactId)
          ) {
            recCount++;
            break; // count the rec set once even if multiple recs cite
          }
        }
      }
      if (recCount > 0) {
        out.push({
          label: `referenced in ${recCount} BU rec${recCount === 1 ? "" : "s"}`,
          count: recCount,
          hint: "A BU recommendation engine pulled this as evidence",
        });
      }
    }

    // Metrics this artifact produced.
    const metricCount = Object.values(metrics).filter(
      (m) =>
        m.sourceKind === artifactKind && m.sourceDocumentId === artifactId,
    ).length;
    if (metricCount > 0) {
      out.push({
        label: `${metricCount} metric${metricCount === 1 ? "" : "s"} extracted`,
        count: metricCount,
        hint: "Quantitative observations pulled from this artifact",
      });
    }

    return out;
  }, [artifactKind, artifactId, syntheses, decks, recs, metrics]);

  if (signals.length === 0) return null;

  return (
    <div
      className={
        "flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground " +
        (className ?? "")
      }
      title={`Load-bearing signal for "${artifactTitle}"`}
    >
      <span className="inline-flex items-center gap-1 text-primary">
        <Sparkles className="w-3 h-3" />
        Load-bearing:
      </span>
      {signals.map((s, i) => (
        <span
          key={i}
          title={s.hint}
          className="inline-flex items-center"
        >
          {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
          <span className="text-foreground/80">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
