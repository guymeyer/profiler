"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type {
  OKR,
  OKRStatus,
  OKRLevel,
  BusinessUnit,
  Person,
} from "@/lib/types";

const STATUSES: { value: OKRStatus; label: string }[] = [
  { value: "on-track", label: "On track" },
  { value: "at-risk", label: "At risk" },
  { value: "off-track", label: "Off track" },
  { value: "achieved", label: "Achieved" },
];

export function OKRForm({
  initial,
  people,
  bus,
  onSubmit,
  onDelete,
  saveLabel = "Save OKR",
}: {
  initial?: OKR;
  people: Person[];
  bus: BusinessUnit[];
  onSubmit: (okr: OKR) => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [keyResults, setKeyResults] = useState<string[]>(
    initial?.keyResults && initial.keyResults.length > 0
      ? initial.keyResults
      : [""],
  );
  const [level, setLevel] = useState<OKRLevel>(initial?.level ?? "company");
  const [businessUnitId, setBusinessUnitId] = useState<string | undefined>(
    initial?.businessUnitId,
  );
  const [ownerPersonIds, setOwnerPersonIds] = useState<string[]>(
    initial?.ownerPersonIds ?? [],
  );
  const [attachedPersonIds, setAttachedPersonIds] = useState<string[]>(
    initial?.attachedPersonIds ?? [],
  );
  const [timeframe, setTimeframe] = useState(initial?.timeframe ?? "");
  const [status, setStatus] = useState<OKRStatus | "">(initial?.status ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function updateKR(i: number, value: string) {
    setKeyResults((cur) => cur.map((kr, idx) => (idx === i ? value : kr)));
  }
  function removeKR(i: number) {
    setKeyResults((cur) => cur.filter((_, idx) => idx !== i));
  }
  function addKR() {
    setKeyResults((cur) => [...cur, ""]);
  }

  function toggle(
    list: string[],
    id: string,
    setter: (next: string[]) => void,
  ) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function save() {
    const id =
      initial?.id ??
      `okr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    onSubmit({
      id,
      objective: objective.trim(),
      keyResults: keyResults.map((k) => k.trim()).filter(Boolean),
      level,
      businessUnitId: level === "bu" ? businessUnitId : undefined,
      ownerPersonIds,
      attachedPersonIds,
      timeframe: timeframe.trim() || "Open-ended",
      status: status || undefined,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: initial ? new Date().toISOString() : undefined,
    });
  }

  const canSave =
    objective.trim().length > 0 &&
    keyResults.some((k) => k.trim().length > 0) &&
    (level === "company" || !!businessUnitId);

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Objective <span className="text-danger">*</span>
          </label>
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="e.g. Become the default platform for mid-market FinOps teams."
            className="mt-1 min-h-[60px]"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Key Results <span className="text-danger">*</span>
          </label>
          <ul className="space-y-2 mt-1">
            {keyResults.map((kr, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-xs font-mono text-muted-foreground mt-2.5 shrink-0">
                  KR{i + 1}
                </span>
                <Input
                  value={kr}
                  onChange={(e) => updateKR(i, e.target.value)}
                  placeholder="Measurable result — number, date, named outcome"
                  className="flex-1"
                />
                {keyResults.length > 1 && (
                  <button
                    onClick={() => removeKR(i)}
                    className="text-muted-foreground hover:text-danger mt-2.5"
                    aria-label="Remove KR"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={addKR}
            className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add KR
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Level <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              {(["company", "bu"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-md border transition-colors",
                    level === l
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l === "company" ? "Company" : "Business Unit"}
                </button>
              ))}
            </div>
          </div>
          {level === "bu" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Business Unit <span className="text-danger">*</span>
              </label>
              <select
                value={businessUnitId ?? ""}
                onChange={(e) => setBusinessUnitId(e.target.value || undefined)}
                className="mt-1 w-full text-sm rounded-md border bg-background px-3 py-1.5"
              >
                <option value="">Select a BU…</option>
                {bus.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
              {bus.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  No BUs defined yet. Go to the OKRs page to add one.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Timeframe
            </label>
            <Input
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="e.g. 2026 Q2 or H1 2026"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OKRStatus | "")}
              className="mt-1 w-full text-sm rounded-md border bg-background px-3 py-1.5"
            >
              <option value="">No status</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context — why this OKR, what's the bet, where the risks are."
            className="mt-1 min-h-[64px]"
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">People</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Owners drive the OKR; attached people are stakeholders whose
          recommendations should be aligned with it. Attaching a person makes
          this OKR appear automatically when they&apos;re in the audience.
        </p>
        <div className="space-y-4">
          <PeoplePicker
            title="Owners"
            people={people}
            selected={ownerPersonIds}
            onToggle={(id) => toggle(ownerPersonIds, id, setOwnerPersonIds)}
          />
          <PeoplePicker
            title="Attached people (stakeholders / contributors)"
            people={people}
            selected={attachedPersonIds}
            onToggle={(id) =>
              toggle(attachedPersonIds, id, setAttachedPersonIds)
            }
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-sm text-muted-foreground hover:text-danger mr-auto"
          >
            Delete
          </button>
        )}
        <Button onClick={save} disabled={!canSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function PeoplePicker({
  title,
  people,
  selected,
  onToggle,
}: {
  title: string;
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(selected.length === 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          {title} ({selected.length})
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Hide list" : "Browse all"}
        </button>
      </div>
      {!expanded && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const p = people.find((x) => x.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-xs hover:bg-primary/15"
              >
                {p.name}
                <X className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      )}
      {expanded && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-72 overflow-auto">
          {people.map((p) => {
            const sel = selected.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => onToggle(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                    sel ? "bg-primary/[0.06]" : "hover:bg-accent/60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    readOnly
                    className="accent-primary"
                  />
                  <Avatar name={p.name} size={20} />
                  <span className="text-sm truncate flex-1">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {p.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
