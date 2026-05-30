"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  ClipboardList,
  Flag,
  LineChart,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfilerStore } from "@/lib/store";
import {
  BU_STANCE_LABELS,
  METRIC_KIND_LABELS,
  PRD_STATUS_LABELS,
  type BURecommendationItem,
  type BURecommendationSet,
  type BURecommendationStance,
  type DerivedMetric,
  type PRDStatus,
} from "@/lib/types";
import { groupMetrics, type MetricGroup } from "@/lib/metrics-aggregate";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Backlinks } from "@/components/backlinks";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ buId: string }>;
}

export default function BusinessUnitDashboardPage({ params }: Props) {
  const { buId } = use(params);
  const bu = useProfilerStore((s) => s.businessUnits?.[buId]);
  const allMetrics = useProfilerStore((s) => s.metrics ?? {});
  const allOkrs = useProfilerStore((s) => s.okrs ?? {});
  const documents = useProfilerStore((s) => s.documents ?? {});
  const recSet = useProfilerStore((s) => s.buRecommendations?.[buId]);
  const saveBURecommendations = useProfilerStore(
    (s) => s.saveBURecommendations,
  );

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const buMetrics = useMemo(
    () =>
      Object.values(allMetrics).filter((m) => m.businessUnitId === buId),
    [allMetrics, buId],
  );
  const groups = useMemo(() => groupMetrics(buMetrics), [buMetrics]);

  const buPrds = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.kind === "prd" && d.linkedBusinessUnitId === buId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents, buId],
  );

  const buOkrs = useMemo(
    () =>
      Object.values(allOkrs).filter(
        (o) => o.level === "bu" && o.businessUnitId === buId,
      ),
    [allOkrs, buId],
  );

  // Find which research artifacts contributed metrics to this BU.
  const sourceDocumentIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of buMetrics) set.add(m.sourceDocumentId);
    return Array.from(set);
  }, [buMetrics]);

  async function handleGenerate() {
    if (!bu) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/bu-recommendations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessUnit: bu,
          metrics: buMetrics,
          research: sourceDocumentIds
            .map((id) => documents[id])
            .filter((d) => d?.kind === "research"),
          prds: buPrds,
          okrs: buOkrs,
          objectives: OBJECTIVES,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${res.status}).`);
      }
      const { recommendations } = (await res.json()) as {
        recommendations: BURecommendationSet;
      };
      saveBURecommendations(recommendations);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (hydrated && !bu) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Business unit not found</h1>
        <Link
          href="/okrs"
          className="text-primary hover:underline inline-flex items-center gap-1 mt-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OKRs
        </Link>
      </div>
    );
  }

  if (!hydrated || !bu) return null;

  return (
    <div>
      <Link
        href="/okrs"
        className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3 h-3" />
        Business units (via OKRs)
      </Link>

      <PageHeader
        eyebrow="Business unit"
        title={bu.name}
        meta={bu.description ?? undefined}
        actions={
          <Button
            onClick={handleGenerate}
            disabled={generating || buMetrics.length === 0}
            title={
              buMetrics.length === 0
                ? "Need at least one metric tied to this BU before recommendations can be generated"
                : ""
            }
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : recSet ? (
              "Regenerate recommendations"
            ) : (
              "Generate recommendations"
            )}
          </Button>
        }
      />

      {error && (
        <div className="text-[13px] text-danger mb-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Recommendations rollup */}
          {recSet && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold">Recommendations</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(recSet.generatedAt).toLocaleString()} ·{" "}
                    {recSet.generatedBy === "mock"
                      ? "mock"
                      : (recSet.model ?? "anthropic")}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed mb-4">
                {recSet.summary}
              </p>
              <div className="space-y-3">
                {recSet.recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={i}
                    rec={rec}
                    metrics={allMetrics}
                    research={documents}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Metrics grid */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">Metrics</h2>
                <span className="text-[11px] text-muted-foreground">
                  {groups.length} tracked · {buMetrics.length} observation
                  {buMetrics.length === 1 ? "" : "s"} across{" "}
                  {sourceDocumentIds.length} source
                  {sourceDocumentIds.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="text-sm text-muted-foreground italic border border-dashed rounded-md p-6 text-center">
                No metrics tied to this BU yet. Add research that mentions{" "}
                quantitative observations — metrics are extracted automatically.
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((g) => (
                  <MetricCard
                    key={g.key}
                    group={g}
                    research={documents}
                    expanded={expandedKey === g.key}
                    onToggle={() =>
                      setExpandedKey(expandedKey === g.key ? null : g.key)
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <aside className="lg:sticky lg:top-20 flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">OKRs in scope</h2>
            </div>
            {buOkrs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No BU-scoped OKRs.
              </p>
            ) : (
              <ul className="space-y-2">
                {buOkrs.map((o) => (
                  <li
                    key={o.id}
                    className="border border-border rounded-md p-3"
                  >
                    <div className="text-sm font-medium leading-snug">
                      {o.objective}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {o.timeframe}
                      {o.status ? ` · ${o.status}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Planned intent</h2>
              {buPrds.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {buPrds.length} PRD{buPrds.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {buPrds.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No PRDs scoped to this BU yet. Link a PRD&apos;s business unit
                on its detail page to see it here.
              </p>
            ) : (
              <ul className="space-y-2">
                {buPrds.map((p) => {
                  if (p.kind !== "prd") return null;
                  const status = p.properties.status;
                  const tone: "subtle" | "neutral" | "success" =
                    status === "shipped"
                      ? "success"
                      : status === "draft"
                        ? "subtle"
                        : "neutral";
                  return (
                    <li
                      key={p.id}
                      className="border border-border rounded-md p-3"
                    >
                      <Link
                        href={`/documents/${p.id}`}
                        className="block hover:text-primary transition-colors"
                      >
                        <div className="text-sm font-medium leading-snug">
                          {p.title}
                        </div>
                      </Link>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge tone={tone} className="text-[10px]">
                          {PRD_STATUS_LABELS[status]}
                        </Badge>
                        {p.properties.successMetrics.length > 0 && (
                          <Badge tone="subtle" className="text-[10px]">
                            {p.properties.successMetrics.length} target metric
                            {p.properties.successMetrics.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {p.properties.targetShipDate && (
                          <Badge tone="subtle" className="text-[10px]">
                            ship{" "}
                            {new Date(p.properties.targetShipDate).toLocaleDateString(
                              undefined,
                              { month: "short", year: "numeric" },
                            )}
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Backlinks entity={{ kind: "business-unit", id: bu.id }} />

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">How this works</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Metrics here are extracted from research (observed) and PRDs
              (target). Two documents mentioning the same metric form a trend
              or a target/actual pair automatically. Click{" "}
              <em>Generate recommendations</em> to compare every tracked
              metric against this BU&apos;s OKRs, source research, and
              planned PRDs.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────

function MetricCard({
  group,
  research,
  expanded,
  onToggle,
}: {
  group: MetricGroup;
  research: Record<string, { id: string; title: string }>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const m = group.latest;
  return (
    <li className="border border-border rounded-md p-3 bg-background/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-sm leading-snug">
            {group.displayName}
          </div>
          <TrendArrow direction={m.changeDirection} sentiment={m.sentiment} />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          {typeof m.value === "number" && (
            <span className="text-foreground font-medium">
              {m.value}
              {m.unit ? ` ${m.unit}` : ""}
            </span>
          )}
          {typeof m.changeMagnitude === "number" && (
            <span
              className={cn(
                m.sentiment === "positive" && "text-emerald-600",
                m.sentiment === "negative" && "text-red-600",
              )}
            >
              {m.changeDirection === "up" ? "+" : "-"}
              {m.changeMagnitude}
              {m.changeUnit === "pct" ? "%" : ""}
            </span>
          )}
          <span>· {m.periodLabel}</span>
          <Badge tone="subtle" className="text-[10px]">
            {METRIC_KIND_LABELS[m.kind]}
          </Badge>
          <Badge tone="neutral" className="text-[10px]">
            {group.observations.length} source
            {group.observations.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {group.observations.map((obs) => (
            <div key={obs.id} className="text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-foreground">{obs.periodLabel}</span>
                {typeof obs.value === "number" && (
                  <span>
                    {obs.value}
                    {obs.unit ? ` ${obs.unit}` : ""}
                  </span>
                )}
                {typeof obs.changeMagnitude === "number" && (
                  <span>
                    {obs.changeDirection === "up" ? "+" : "-"}
                    {obs.changeMagnitude}
                    {obs.changeUnit === "pct" ? "%" : ""}
                  </span>
                )}
              </div>
              {obs.evidenceQuote && (
                <div className="italic text-muted-foreground border-l-2 border-border pl-2 mt-1 line-clamp-3">
                  &ldquo;{obs.evidenceQuote}&rdquo;
                </div>
              )}
              <Link
                href={`/documents/${obs.sourceDocumentId}`}
                className="text-primary hover:underline text-[11px] inline-flex items-center gap-1 mt-1"
              >
                {research[obs.sourceDocumentId]?.title ?? "source research"}
              </Link>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function TrendArrow({
  direction,
  sentiment,
}: {
  direction: DerivedMetric["changeDirection"];
  sentiment: DerivedMetric["sentiment"];
}) {
  const tone =
    sentiment === "positive"
      ? "text-emerald-600"
      : sentiment === "negative"
        ? "text-red-600"
        : "text-muted-foreground";
  if (direction === "up")
    return <ArrowUpRight className={cn("w-4 h-4 shrink-0", tone)} />;
  if (direction === "down")
    return <ArrowDownRight className={cn("w-4 h-4 shrink-0", tone)} />;
  if (direction === "flat")
    return <Minus className="w-4 h-4 shrink-0 text-muted-foreground" />;
  return null;
}

const STANCE_STYLES: Record<
  BURecommendationStance,
  { badge: string; border: string }
> = {
  amplify: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    border: "border-emerald-200",
  },
  guard: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    border: "border-amber-200",
  },
  pivot: {
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    border: "border-orange-200",
  },
  investigate: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    border: "border-slate-200",
  },
  escalate: {
    badge: "bg-red-100 text-red-800 border-red-200",
    border: "border-red-200",
  },
};

function RecommendationCard({
  rec,
  metrics,
  research,
}: {
  rec: BURecommendationItem;
  metrics: Record<string, DerivedMetric>;
  research: Record<string, { id: string; title: string }>;
}) {
  const styles = STANCE_STYLES[rec.stance];
  return (
    <article className={cn("rounded-lg border p-4", styles.border)}>
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border",
            styles.badge,
          )}
        >
          {BU_STANCE_LABELS[rec.stance]}
        </span>
        <h3 className="font-semibold text-sm flex-1 min-w-0 leading-snug">
          {rec.headline}
        </h3>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed mb-3">
        {rec.rationale}
      </p>

      {rec.metricIds.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-medium text-foreground">Metrics: </span>
          {rec.metricIds.map((id, i) => {
            const m = metrics[id];
            if (!m) return null;
            return (
              <span key={id}>
                {i > 0 && ", "}
                <em>{m.name}</em>
              </span>
            );
          })}
        </div>
      )}

      {rec.researchCitations.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-medium text-foreground">Research: </span>
          {rec.researchCitations.map((c, i) => (
            <span key={i}>
              {i > 0 && ", "}
              <Link
                href={`/documents/${c.researchId}`}
                className="text-primary hover:underline"
                title={c.relevance}
              >
                {research[c.researchId]?.title ?? c.researchId}
              </Link>
            </span>
          ))}
        </div>
      )}

      {rec.nextActions.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Next actions
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {rec.nextActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}

      {rec.risks.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground italic">
          <span className="font-medium not-italic text-foreground">
            Risks:{" "}
          </span>
          {rec.risks.join("; ")}
        </div>
      )}
    </article>
  );
}
