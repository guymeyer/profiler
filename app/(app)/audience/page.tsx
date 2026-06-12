"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Save,
  Trash2,
  Users,
  Target,
  FileSearch,
  Sparkles,
  X,
  Compass,
  Building2,
  BookOpen,
  Flag,
} from "lucide-react";
import { OBJECTIVES } from "@/lib/data/objectives";
import { useProfilerStore } from "@/lib/store";
import {
  useEffectivePeople,
  useInternalPeople,
  sortByOrgChart,
  INFLUENCE_LEVELS,
  INFLUENCE_LABELS,
} from "@/lib/people-hooks";
import { detectAudienceConflicts } from "@/lib/audience-conflicts";
import { AlertTriangle, Info } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AudiencePage() {
  const PEOPLE = useInternalPeople();
  const ALL_PEOPLE = useEffectivePeople();
  const personIds = useProfilerStore((s) => s.selectedPersonIds);
  const objectiveIds = useProfilerStore((s) => s.selectedObjectiveIds);
  const intent = useProfilerStore((s) => s.audienceIntent ?? "");
  const setIntent = useProfilerStore((s) => s.setAudienceIntent);
  const customers = useProfilerStore((s) => s.customers ?? {});
  const selectedCustomerId = useProfilerStore((s) => s.selectedCustomerId);
  const setSelectedCustomerId = useProfilerStore((s) => s.setSelectedCustomerId);
  const selectedCustomer = selectedCustomerId
    ? customers[selectedCustomerId]
    : undefined;
  const togglePerson = useProfilerStore((s) => s.togglePerson);
  const toggleObjective = useProfilerStore((s) => s.toggleObjective);
  const clearSelection = useProfilerStore((s) => s.clearSelection);
  const saved = useProfilerStore((s) => s.savedAudiences);
  const saveAudience = useProfilerStore((s) => s.saveAudience);
  const deleteAudience = useProfilerStore((s) => s.deleteAudience);
  const loadAudience = useProfilerStore((s) => s.loadAudience);

  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const filteredPeople = PEOPLE.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.title.toLowerCase().includes(term) ||
      p.team.toLowerCase().includes(term)
    );
  });

  const selectedPeople = ALL_PEOPLE.filter((p) => personIds.includes(p.id));
  const customerEmployees = selectedCustomerId
    ? ALL_PEOPLE.filter((p) => p.customerId === selectedCustomerId).sort(
        sortByOrgChart,
      )
    : [];

  const documents = useProfilerStore((s) => s.documents ?? {});
  const selectedResearchIds = useProfilerStore((s) => s.selectedResearchIds ?? []);
  const toggleResearch = useProfilerStore((s) => s.toggleResearch);
  const okrs = useProfilerStore((s) => s.okrs ?? {});
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const selectedOKRIds = useProfilerStore((s) => s.selectedOKRIds ?? []);
  const toggleOKR = useProfilerStore((s) => s.toggleOKR);

  // Research artifacts ranked: linked-to-current-selection first, then everything else.
  const allResearch = Object.values(documents).filter((d) => d.kind === "research");
  const researchSuggested = allResearch.filter(
    (r) =>
      r.linkedPersonIds.some((id) => personIds.includes(id)) ||
      (selectedCustomerId && r.linkedCustomerIds.includes(selectedCustomerId)) ||
      r.linkedObjectiveIds.some((id) => objectiveIds.includes(id)),
  );
  const researchOther = allResearch.filter(
    (r) => !researchSuggested.includes(r),
  );

  // OKRs surfaced automatically when one of their attached people is in the audience.
  const okrsSuggested = Object.values(okrs).filter((o) =>
    o.attachedPersonIds.some((id) => personIds.includes(id)) ||
    o.ownerPersonIds.some((id) => personIds.includes(id)),
  );
  const okrsOther = Object.values(okrs).filter(
    (o) => !okrsSuggested.includes(o),
  );
  const selectedObjectives = OBJECTIVES.filter((o) =>
    objectiveIds.includes(o.id),
  );

  // Audience read summary (deterministic, no LLM needed for this preview)
  const exec = selectedPeople.filter((p) => p.influence === "executive").length;
  const styles = new Set(selectedPeople.flatMap((p) => p.commStyle));
  const conflicts = detectAudienceConflicts(selectedPeople);

  const canGenerate =
    personIds.length > 0 || objectiveIds.length > 0 || !!selectedCustomer;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audience builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Select the people and objectives you&apos;re presenting to. Then generate a
          strategy or jump to the artifact analyzer.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* Left: pickers */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Your intent</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                Optional
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              What you&apos;re trying to accomplish. Useful when the audience is an
              external customer, the need is unclear, or you want recommendations
              tailored to a specific outcome.
            </p>
            <Textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. Convince an unknown enterprise prospect that our platform is the safer choice — they care about reliability and total cost of ownership."
              className="min-h-[88px] text-sm"
            />
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
              <span>
                {intent.trim().length === 0
                  ? "Skip if you have a known person and a concrete artifact."
                  : `${intent.trim().length} characters`}
              </span>
              {intent.trim().length > 0 && (
                <button
                  onClick={() => setIntent("")}
                  className="hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">People</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {personIds.length} selected
              </span>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="mt-3"
            />
            <ul className="mt-3 divide-y">
              {filteredPeople.map((p) => {
                const sel = personIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => togglePerson(p.id)}
                      className={cn(
                        "w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md text-left transition-colors",
                        sel ? "bg-primary/[0.05]" : "hover:bg-accent/60",
                      )}
                    >
                      <Avatar name={p.name} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-tight truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.title} · {p.team}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border inline-flex items-center justify-center shrink-0",
                          sel
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {sel && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Customer</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                Optional
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Attach a company to tailor recommendations to their buying triggers
              and evaluation criteria.
            </p>
            {Object.keys(customers).length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No customers yet.{" "}
                <Link href="/customers/new" className="text-primary hover:underline">
                  Add one
                </Link>{" "}
                or{" "}
                <Link
                  href="/customers/new?research=1"
                  className="text-primary hover:underline"
                >
                  research a company
                </Link>
                .
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedCustomerId(undefined)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-colors",
                    !selectedCustomerId
                      ? "border-primary bg-primary/[0.04]"
                      : "border-border hover:bg-accent/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">No customer</span>
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border inline-flex items-center justify-center shrink-0",
                        !selectedCustomerId
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {!selectedCustomerId && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    General audience — no specific company context.
                  </p>
                </button>
                {Object.values(customers).map((c) => {
                  const sel = selectedCustomerId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setSelectedCustomerId(sel ? undefined : c.id)
                      }
                      className={cn(
                        "text-left p-3 rounded-lg border transition-colors",
                        sel
                          ? "border-primary bg-primary/[0.04]"
                          : "border-border hover:bg-accent/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {c.name}
                        </span>
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border inline-flex items-center justify-center shrink-0",
                            sel
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {sel && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {c.industry ? `${c.industry} · ` : ""}
                        {c.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {selectedCustomer && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">
                  {selectedCustomer.name} team
                </h2>
                <Link
                  href={`/customers/${selectedCustomer.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  Manage
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Stakeholders attached to {selectedCustomer.name}. Add them to the
                audience to tailor framing to the people who'll actually decide.
              </p>
              {customerEmployees.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  No employees yet for this customer.{" "}
                  <Link
                    href={`/customers/${selectedCustomer.id}`}
                    className="text-primary hover:underline"
                  >
                    Discover stakeholders
                  </Link>
                  .
                </div>
              ) : (
                <ul className="space-y-1">
                  {INFLUENCE_LEVELS.map((level) => {
                    const members = customerEmployees.filter(
                      (p) => p.influence === level,
                    );
                    if (members.length === 0) return null;
                    return (
                      <li key={level} className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground pt-1">
                          {INFLUENCE_LABELS[level]}
                        </div>
                        {members.map((p) => {
                          const sel = personIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
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
                              <span className="text-sm truncate">{p.name}</span>
                              <span className="ml-auto text-[11px] text-muted-foreground truncate">
                                {p.title}
                              </span>
                            </button>
                          );
                        })}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Research</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedResearchIds.length} selected
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Inject internal research as primary-source evidence. The model
              must cite anything you attach here.
            </p>
            {allResearch.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No research yet.{" "}
                <Link href="/research/new" className="text-primary hover:underline">
                  Upload some
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {researchSuggested.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1.5">
                      Suggested · linked to your selection
                    </div>
                    <ResearchRows
                      list={researchSuggested}
                      selected={selectedResearchIds}
                      onToggle={toggleResearch}
                    />
                  </div>
                )}
                {researchOther.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                      Browse all ({researchOther.length})
                    </summary>
                    <div className="mt-2">
                      <ResearchRows
                        list={researchOther}
                        selected={selectedResearchIds}
                        onToggle={toggleResearch}
                      />
                    </div>
                  </details>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">OKRs</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedOKRIds.length} selected
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Recommendations will be framed to explicitly advance these. OKRs
              attached to your selected people surface as suggestions.
            </p>
            {Object.keys(okrs).length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No OKRs defined yet.{" "}
                <Link href="/okrs/new" className="text-primary hover:underline">
                  Add one
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {okrsSuggested.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1.5">
                      Suggested · attached to your selection
                    </div>
                    <OKRRows
                      list={okrsSuggested}
                      selected={selectedOKRIds}
                      onToggle={toggleOKR}
                      bus={businessUnits}
                    />
                  </div>
                )}
                {okrsOther.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                      Browse all ({okrsOther.length})
                    </summary>
                    <div className="mt-2">
                      <OKRRows
                        list={okrsOther}
                        selected={selectedOKRIds}
                        onToggle={toggleOKR}
                        bus={businessUnits}
                      />
                    </div>
                  </details>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Objectives</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {objectiveIds.length} selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OBJECTIVES.map((o) => {
                const sel = objectiveIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleObjective(o.id)}
                    className={cn(
                      "text-left p-3 rounded-lg border transition-colors",
                      sel
                        ? "border-primary bg-primary/[0.04]"
                        : "border-border hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{o.title}</span>
                      <div
                        className={cn(
                          "w-4 h-4 rounded border inline-flex items-center justify-center shrink-0",
                          sel
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {sel && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {o.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: preview + actions */}
        <aside className="xl:sticky xl:top-20 xl:self-start space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Audience preview</h3>
              {(personIds.length > 0 || objectiveIds.length > 0) && (
                <button
                  onClick={clearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {personIds.length === 0 &&
            objectiveIds.length === 0 &&
            !selectedCustomer ? (
              <p className="text-sm text-muted-foreground py-2">
                Pick a person, objective, or customer to build an audience.
              </p>
            ) : (
              <div className="space-y-4">
                {selectedPeople.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      People ({selectedPeople.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPeople.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => togglePerson(p.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          {p.name}
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedObjectives.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      Objectives ({selectedObjectives.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedObjectives.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => toggleObjective(o.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-xs hover:bg-primary/15"
                        >
                          {o.title}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedCustomer && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                      Customer
                    </div>
                    <Link
                      href={`/customers/${selectedCustomer.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-xs hover:bg-primary/15"
                    >
                      <Building2 className="w-3 h-3" />
                      {selectedCustomer.name}
                    </Link>
                  </div>
                )}
                {selectedPeople.length > 0 && (
                  <div className="border-t pt-3 text-sm text-foreground/80 leading-relaxed">
                    <span className="font-medium">{exec}</span> exec
                    {exec === 1 ? "" : "s"} · communication mix:{" "}
                    <span className="text-foreground">
                      {Array.from(styles).slice(0, 3).join(", ")}
                      {styles.size > 3 ? "…" : ""}
                    </span>
                  </div>
                )}
                {conflicts.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Framing tensions
                    </div>
                    {conflicts.map((c, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-start gap-2 text-xs rounded-md p-2 border",
                          c.severity === "warn"
                            ? "bg-warning/[0.06] border-warning/30 text-foreground"
                            : "bg-muted/40 border-border text-muted-foreground",
                        )}
                      >
                        {c.severity === "warn" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-[1px]" />
                        ) : (
                          <Info className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
                        )}
                        <span className="leading-relaxed">{c.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <Link
              href={`/analyze?personIds=${personIds.join(",")}&objectiveIds=${objectiveIds.join(",")}`}
              className={cn("block", !canGenerate && "pointer-events-none")}
            >
              <Button className="w-full" disabled={!canGenerate}>
                <FileSearch className="w-3.5 h-3.5" />
                Analyze artifact for this audience
              </Button>
            </Link>
            <Link
              href={`/analyze?strategy=1&personIds=${personIds.join(",")}&objectiveIds=${objectiveIds.join(",")}`}
              className={cn("block", !canGenerate && "pointer-events-none")}
            >
              <Button
                variant="secondary"
                className="w-full"
                disabled={!canGenerate}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate audience strategy
              </Button>
            </Link>
            <p className="text-[11px] text-muted-foreground">
              Strategy mode produces a meeting/readout approach without
              analyzing a specific artifact.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Save this audience</h3>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 leadership review"
                disabled={!canGenerate}
              />
              <Button
                onClick={() => {
                  if (!name.trim()) return;
                  saveAudience(name.trim());
                  setName("");
                }}
                disabled={!canGenerate || !name.trim()}
                size="md"
              >
                <Save className="w-3.5 h-3.5" />
              </Button>
            </div>

            {saved.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {saved.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm group"
                  >
                    <button
                      onClick={() => loadAudience(a.id)}
                      className="flex-1 min-w-0 text-left hover:text-primary"
                    >
                      <span className="truncate block">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {a.personIds.length} people ·{" "}
                        {a.objectiveIds.length} objectives
                      </span>
                    </button>
                    <Badge tone="subtle">Load</Badge>
                    <button
                      onClick={() => deleteAudience(a.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger"
                      aria-label="Delete audience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ResearchRows({
  list,
  selected,
  onToggle,
}: {
  list: import("@/lib/types").ResearchDocument[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {list.map((r) => {
        const sel = selected.includes(r.id);
        return (
          <li key={r.id}>
            <button
              onClick={() => onToggle(r.id)}
              className={cn(
                "w-full flex items-start gap-2 px-2 py-2 rounded-md text-left transition-colors",
                sel ? "bg-primary/[0.06]" : "hover:bg-accent/60",
              )}
            >
              <input
                type="checkbox"
                checked={sel}
                readOnly
                className="accent-primary mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight truncate">
                  {r.title}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.source}
                  {r.properties.conductedAt
                    ? ` · ${new Date(r.properties.conductedAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`
                    : ""}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OKRRows({
  list,
  selected,
  onToggle,
  bus,
}: {
  list: import("@/lib/types").OKR[];
  selected: string[];
  onToggle: (id: string) => void;
  bus: Record<string, import("@/lib/types").BusinessUnit>;
}) {
  return (
    <ul className="space-y-1">
      {list.map((o) => {
        const sel = selected.includes(o.id);
        const buName = o.businessUnitId ? bus[o.businessUnitId]?.name : undefined;
        return (
          <li key={o.id}>
            <button
              onClick={() => onToggle(o.id)}
              className={cn(
                "w-full flex items-start gap-2 px-2 py-2 rounded-md text-left transition-colors",
                sel ? "bg-primary/[0.06]" : "hover:bg-accent/60",
              )}
            >
              <input
                type="checkbox"
                checked={sel}
                readOnly
                className="accent-primary mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-snug line-clamp-2">
                  {o.objective}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {o.level === "company"
                    ? "Company"
                    : buName ?? "BU"} · {o.timeframe}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
