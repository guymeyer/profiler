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
} from "lucide-react";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import { useProfilerStore } from "@/lib/store";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AudiencePage() {
  const personIds = useProfilerStore((s) => s.selectedPersonIds);
  const objectiveIds = useProfilerStore((s) => s.selectedObjectiveIds);
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

  const selectedPeople = PEOPLE.filter((p) => personIds.includes(p.id));
  const selectedObjectives = OBJECTIVES.filter((o) =>
    objectiveIds.includes(o.id),
  );

  // Audience read summary (deterministic, no LLM needed for this preview)
  const exec = selectedPeople.filter((p) => p.influence === "executive").length;
  const styles = new Set(selectedPeople.flatMap((p) => p.commStyle));

  const canGenerate = personIds.length > 0;

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audience builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Select the people and objectives you're presenting to. Then generate a
          strategy or jump to the artifact analyzer.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* Left: pickers */}
        <div className="space-y-6">
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

            {personIds.length === 0 && objectiveIds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Select people and objectives to build an audience.
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
