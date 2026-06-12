"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useProfilerStore } from "@/lib/store";
import {
  useEffectivePeople,
  useInternalPeople,
  INFLUENCE_LEVELS,
  INFLUENCE_LABELS,
} from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { runAnalysis } from "@/app/actions";
import type { RecommendationResult, Customer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ resultId: string }>;
}

export default function DeltaPage({ params }: Props) {
  const { resultId } = use(params);
  const original = useProfilerStore((s) => s.results[resultId]);
  const storeResult = useProfilerStore((s) => s.storeResult);
  const addRecent = useProfilerStore((s) => s.addRecentResult);
  const customers = useProfilerStore((s) => s.customers ?? {});

  const INTERNAL = useInternalPeople();
  const ALL = useEffectivePeople();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [personIds, setPersonIds] = useState<string[]>([]);
  const [objectiveIds, setObjectiveIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [intent, setIntent] = useState("");
  const [seeded, setSeeded] = useState(false);

  const [delta, setDelta] = useState<RecommendationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed local state from original once it loads
  useEffect(() => {
    if (!seeded && original) {
      setPersonIds([...original.artifact.selectedPersonIds]);
      setObjectiveIds([...original.artifact.selectedObjectiveIds]);
      setCustomerId(original.artifact.customer?.id);
      setIntent(original.artifact.intent ?? "");
      setSeeded(true);
    }
  }, [original, seeded]);

  const customerEmployees = useMemo(() => {
    if (!customerId) return [];
    return ALL.filter((p) => p.customerId === customerId);
  }, [customerId, ALL]);

  if (!hydrated) return null;
  if (!original) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Result not found</h1>
        <p className="text-muted-foreground mt-2">
          The result you're comparing against isn't in your local store.
        </p>
        <div className="mt-6">
          <Link href="/analyze">
            <Button>Run a new analysis</Button>
          </Link>
        </div>
      </div>
    );
  }

  function togglePerson(id: string) {
    setPersonIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }
  function toggleObjective(id: string) {
    setObjectiveIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  const customer: Customer | undefined = customerId
    ? customers[customerId]
    : undefined;

  const isStrategy = !original.artifact.rawContent;
  const noAudience =
    personIds.length === 0 && objectiveIds.length === 0 && !customer;

  async function runDelta() {
    setError(null);
    setRunning(true);
    try {
      const audienceOverrides = ALL.filter((p) => personIds.includes(p.id));
      const result = await runAnalysis({
        title: original!.artifact.title + " (delta)",
        type: original!.artifact.type,
        rawContent: original!.artifact.rawContent ?? "",
        personIds,
        objectiveIds,
        intent: intent.trim() || undefined,
        customer,
        strategyOnly: isStrategy,
        audienceOverrides,
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
      setDelta(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <Link
        href={`/results/${original.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to result
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          What if? — {original.artifact.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          Swap audience variables and re-run with the same artifact. See how the
          recommendation shifts.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-6">
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Audience for the re-run</h3>

            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  People
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {INTERNAL.map((p) => {
                    const sel = personIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => togglePerson(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                            sel
                              ? "bg-primary/[0.06]"
                              : "hover:bg-accent/60",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            readOnly
                            className="accent-primary"
                          />
                          <Avatar name={p.name} size={20} />
                          <span className="text-sm truncate flex-1">
                            {p.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {p.influence}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {customerEmployees.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                    {customer?.name} team
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {INFLUENCE_LEVELS.flatMap((level) =>
                      customerEmployees
                        .filter((p) => p.influence === level)
                        .map((p) => {
                          const sel = personIds.includes(p.id);
                          return (
                            <li key={p.id}>
                              <button
                                onClick={() => togglePerson(p.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                                  sel
                                    ? "bg-primary/[0.06]"
                                    : "hover:bg-accent/60",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  readOnly
                                  className="accent-primary"
                                />
                                <span className="text-sm truncate flex-1">
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {INFLUENCE_LABELS[level]}
                                </span>
                              </button>
                            </li>
                          );
                        }),
                    )}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  Objectives
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {OBJECTIVES.map((o) => {
                    const sel = objectiveIds.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggleObjective(o.id)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
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
                    );
                  })}
                </div>
              </div>

              {Object.keys(customers).length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                    Customer
                  </div>
                  <select
                    value={customerId ?? ""}
                    onChange={(e) =>
                      setCustomerId(e.target.value || undefined)
                    }
                    className="text-sm rounded-md border bg-background px-3 py-1.5 w-full"
                  >
                    <option value="">No customer</option>
                    {Object.values(customers).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  Intent
                </div>
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="Optional — what you're trying to accomplish."
                  className="w-full min-h-[64px] text-sm rounded-md border bg-background px-3 py-2"
                />
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">What changed</h3>
            <ChangeSummary
              original={original}
              personIds={personIds}
              objectiveIds={objectiveIds}
              customerId={customerId}
              intent={intent}
              allPeople={ALL}
              customers={customers}
            />
          </Card>

          {error && (
            <Card className="p-4 border-danger/30 bg-danger/[0.05]">
              <div className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </Card>
          )}

          <Button
            onClick={runDelta}
            disabled={running || noAudience}
            className="w-full"
            size="lg"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running delta…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run delta
              </>
            )}
          </Button>
          {delta && (
            <Link href={`/results/${delta.id}`}>
              <Button variant="secondary" className="w-full">
                Open full delta result
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
        </aside>
      </div>

      {delta && <Comparison original={original} delta={delta} />}
    </div>
  );
}

function ChangeSummary({
  original,
  personIds,
  objectiveIds,
  customerId,
  intent,
  allPeople,
  customers,
}: {
  original: RecommendationResult;
  personIds: string[];
  objectiveIds: string[];
  customerId?: string;
  intent: string;
  allPeople: { id: string; name: string }[];
  customers: Record<string, Customer>;
}) {
  const origPeople = new Set(original.artifact.selectedPersonIds);
  const newPeople = new Set(personIds);
  const addedPeople = [...newPeople].filter((id) => !origPeople.has(id));
  const removedPeople = [...origPeople].filter((id) => !newPeople.has(id));

  const origObjs = new Set(original.artifact.selectedObjectiveIds);
  const newObjs = new Set(objectiveIds);
  const addedObjs = [...newObjs].filter((id) => !origObjs.has(id));
  const removedObjs = [...origObjs].filter((id) => !newObjs.has(id));

  const origCustomerId = original.artifact.customer?.id;
  const customerChanged = origCustomerId !== customerId;

  const origIntent = original.artifact.intent ?? "";
  const intentChanged = origIntent.trim() !== intent.trim();

  const personName = (id: string) =>
    allPeople.find((p) => p.id === id)?.name ?? id;
  const objTitle = (id: string) =>
    OBJECTIVES.find((o) => o.id === id)?.title ?? id;

  const empty =
    addedPeople.length === 0 &&
    removedPeople.length === 0 &&
    addedObjs.length === 0 &&
    removedObjs.length === 0 &&
    !customerChanged &&
    !intentChanged;

  if (empty) {
    return (
      <p className="text-sm text-muted-foreground">
        No changes yet. Toggle people, objectives, customer, or intent to set
        up the delta.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {addedPeople.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-success mb-1">
            + Added
          </div>
          <div className="flex flex-wrap gap-1.5">
            {addedPeople.map((id) => (
              <Badge key={id} tone="primary">
                {personName(id)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {removedPeople.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-danger mb-1">
            − Removed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {removedPeople.map((id) => (
              <Badge key={id} tone="subtle" className="line-through">
                {personName(id)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {(addedObjs.length > 0 || removedObjs.length > 0) && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Objectives
          </div>
          <div className="flex flex-wrap gap-1.5">
            {addedObjs.map((id) => (
              <Badge key={id} tone="primary">
                + {objTitle(id)}
              </Badge>
            ))}
            {removedObjs.map((id) => (
              <Badge key={id} tone="subtle" className="line-through">
                − {objTitle(id)}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {customerChanged && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Customer
          </div>
          <div className="text-xs">
            <span className="line-through text-muted-foreground">
              {original.artifact.customer?.name ?? "—"}
            </span>{" "}
            →{" "}
            <span className="font-medium">
              {customerId ? customers[customerId]?.name ?? "—" : "—"}
            </span>
          </div>
        </div>
      )}
      {intentChanged && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Intent
          </div>
          <div className="text-xs text-muted-foreground italic">
            {intent ? `"${intent.slice(0, 120)}"` : "(cleared)"}
          </div>
        </div>
      )}
    </div>
  );
}

function Comparison({
  original,
  delta,
}: {
  original: RecommendationResult;
  delta: RecommendationResult;
}) {
  const fitDelta = delta.fitScore - original.fitScore;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Delta — what shifted</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
              Original
            </div>
            <ResultSnapshot result={original} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5 flex items-center gap-2">
              Delta
              <FitChip delta={fitDelta} />
            </div>
            <ResultSnapshot result={delta} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Do's diff</h3>
        <ListDiff original={original.dos ?? []} updated={delta.dos ?? []} />
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Don'ts diff</h3>
        <ListDiff
          original={original.donts ?? []}
          updated={delta.donts ?? []}
        />
      </Card>
    </div>
  );
}

function ResultSnapshot({ result }: { result: RecommendationResult }) {
  return (
    <div className="rounded-md border bg-surface/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="font-semibold text-foreground">
          Fit {result.fitScore}/100
        </span>
        <span>· confidence: {result.confidence}</span>
      </div>
      {result.tldr && (
        <p className="text-sm leading-relaxed font-medium">{result.tldr}</p>
      )}
    </div>
  );
}

function FitChip({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="w-3 h-3" />
        no change
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-semibold">
        <TrendingUp className="w-3 h-3" />+{delta} fit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-danger font-semibold">
      <TrendingDown className="w-3 h-3" />
      {delta} fit
    </span>
  );
}

function ListDiff({
  original,
  updated,
}: {
  original: string[];
  updated: string[];
}) {
  const origSet = new Set(original);
  const newSet = new Set(updated);
  const added = updated.filter((x) => !origSet.has(x));
  const removed = original.filter((x) => !newSet.has(x));
  const kept = updated.filter((x) => origSet.has(x));

  if (added.length === 0 && removed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No changes — same list of {updated.length} items.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {added.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-success mb-1">
            + Added ({added.length})
          </div>
          <ul className="space-y-1">
            {added.map((x, i) => (
              <li
                key={i}
                className="text-sm bg-success/[0.06] border border-success/20 rounded p-2 leading-relaxed"
              >
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide font-semibold text-danger mb-1">
            − Removed ({removed.length})
          </div>
          <ul className="space-y-1">
            {removed.map((x, i) => (
              <li
                key={i}
                className="text-sm bg-danger/[0.06] border border-danger/20 rounded p-2 leading-relaxed line-through opacity-80"
              >
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kept.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            {kept.length} unchanged
          </summary>
          <ul className="mt-1.5 space-y-1">
            {kept.map((x, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <Check className="w-3 h-3 shrink-0 mt-1 text-muted-foreground" />
                {x}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
