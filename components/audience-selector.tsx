"use client";
import { useMemo, useState } from "react";
import { Search, Users, Target, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { DeckAudience, Objective, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

// Focused audience picker shared between the synthesis deck wizard and any
// other flow that needs "who am I presenting to?". Same essential UX as the
// full /audience page (multi-select people + objectives + intent), but
// tightly scoped and embeddable as a wizard step.

interface Props {
  people: Person[];
  objectives: Objective[];
  value: DeckAudience;
  onChange: (next: DeckAudience) => void;
}

export function AudienceSelector({
  people,
  objectives,
  value,
  onChange,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredPeople = useMemo(() => {
    if (!search.trim()) return people;
    const term = search.toLowerCase();
    return people.filter((p) =>
      [p.name, p.title, p.team].some((s) => s.toLowerCase().includes(term)),
    );
  }, [people, search]);

  const selectedPeople = useMemo(
    () => people.filter((p) => value.personIds.includes(p.id)),
    [people, value.personIds],
  );

  function togglePerson(id: string) {
    onChange({
      ...value,
      personIds: value.personIds.includes(id)
        ? value.personIds.filter((x) => x !== id)
        : [...value.personIds, id],
    });
  }

  function toggleObjective(id: string) {
    onChange({
      ...value,
      objectiveIds: value.objectiveIds.includes(id)
        ? value.objectiveIds.filter((x) => x !== id)
        : [...value.objectiveIds, id],
    });
  }

  function setIntent(next: string) {
    onChange({ ...value, intent: next });
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">
              Who are you presenting to?
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                {value.personIds.length} selected
              </span>
            </h3>
          </div>
        </div>

        {selectedPeople.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {selectedPeople.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePerson(p.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-2 py-1 text-xs text-primary hover:bg-primary/15"
                title="Remove from audience"
              >
                <Avatar name={p.name} size={18} />
                {p.name}
                <span className="text-primary/60">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, team…"
            className="pl-8"
          />
        </div>

        {filteredPeople.length === 0 ? (
          <div className="text-sm text-muted-foreground italic border border-dashed rounded-md p-4 text-center">
            No matches.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[320px] overflow-auto pr-1">
            {filteredPeople.map((p) => {
              const checked = value.personIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => togglePerson(p.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors",
                      checked ? "bg-accent/60" : "hover:bg-accent/30",
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
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">
            What outcomes are you presenting against?
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              {value.objectiveIds.length} selected
            </span>
          </h3>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {objectives.map((o) => {
            const checked = value.objectiveIds.includes(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggleObjective(o.id)}
                  className={cn(
                    "w-full text-left rounded-md border p-3 transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded border shrink-0 inline-flex items-center justify-center",
                        checked
                          ? "bg-primary border-primary"
                          : "border-border",
                      )}
                    >
                      {checked && (
                        <svg
                          className="w-2.5 h-2.5 text-primary-foreground"
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
                    <div className="font-medium text-sm">{o.title}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug ml-5">
                    {o.description}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">
            Intent
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              optional
            </span>
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          One line on what you want this room to do after they see this. Drives
          how the content gets compressed and what the call-to-action slide
          says. e.g. &ldquo;Approve funding for the AI Platform investment&rdquo;,
          &ldquo;Get sign-off on the troubleshooter spec.&rdquo;
        </p>
        <Textarea
          value={value.intent ?? ""}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What should this audience walk away thinking, agreeing to, or doing?"
          rows={2}
        />
      </Card>

      <AudienceSummary
        people={selectedPeople}
        objectives={objectives.filter((o) => value.objectiveIds.includes(o.id))}
        intent={value.intent}
      />
    </div>
  );
}

function AudienceSummary({
  people,
  objectives,
  intent,
}: {
  people: Person[];
  objectives: Objective[];
  intent?: string;
}) {
  if (people.length === 0 && objectives.length === 0 && !intent?.trim()) {
    return null;
  }
  return (
    <Card className="p-4 bg-accent/30 border-accent">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
        Audience summary
      </div>
      <div className="text-sm space-y-2">
        {people.length > 0 && (
          <div>
            <span className="text-muted-foreground">Reading:</span>{" "}
            {people.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <strong>{p.name}</strong>
              </span>
            ))}
          </div>
        )}
        {objectives.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground">Against:</span>
            {objectives.map((o) => (
              <Badge key={o.id} tone="subtle" className="text-[10px]">
                {o.title}
              </Badge>
            ))}
          </div>
        )}
        {intent?.trim() && (
          <div>
            <span className="text-muted-foreground">Intent:</span>{" "}
            <em>{intent.trim()}</em>
          </div>
        )}
      </div>
    </Card>
  );
}
