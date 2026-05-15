"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Building2,
  AlertTriangle,
  Sparkles,
  Loader2,
  Users,
  Compass,
  ShieldAlert,
  Flag,
  FileSearch,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useProfilerStore } from "@/lib/store";
import {
  customerToMarkdown,
  markdownToCustomer,
} from "@/lib/customer-md";
import {
  researchCustomer,
  researchCustomerStakeholders,
} from "@/app/customers/actions";
import {
  useCustomerEmployees,
  INFLUENCE_LEVELS,
  INFLUENCE_LABELS,
  sortByOrgChart,
} from "@/lib/people-hooks";
import { Avatar } from "@/components/ui/avatar";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ customerId: string }>;
}

export default function CustomerPage({ params }: Props) {
  const { customerId } = use(params);
  const router = useRouter();
  const customer = useProfilerStore((s) => s.customers?.[customerId]);
  const saveCustomer = useProfilerStore((s) => s.saveCustomer);
  const deleteCustomer = useProfilerStore((s) => s.deleteCustomer);
  const setSelectedCustomerId = useProfilerStore((s) => s.setSelectedCustomerId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (editing && customer) {
      setDraft(customerToMarkdown(customer));
      setWarnings([]);
    }
  }, [editing, customer]);

  if (!hydrated) return null;
  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Customer not found</h1>
        <p className="text-muted-foreground mt-2">
          They may have been deleted or generated in another browser.
        </p>
        <div className="mt-6">
          <Link href="/customers">
            <Button>Back to customers</Button>
          </Link>
        </div>
      </div>
    );
  }

  function handleSave() {
    const { customer: parsed, warnings: parseWarnings } = markdownToCustomer(
      draft,
      { existingId: customer!.id, existing: customer! },
    );
    saveCustomer(parsed);
    setWarnings(parseWarnings);
    setEditing(false);
  }

  function handleDelete() {
    deleteCustomer(customer!.id);
    router.push("/customers");
  }

  async function handleReresearch() {
    setResearchError(null);
    setResearching(true);
    try {
      const result = await researchCustomer({
        companyName: customer!.name,
        context: customer!.summary || undefined,
      });
      // Merge — keep id and createdAt, replace research-derived fields
      saveCustomer({
        ...result,
        id: customer!.id,
        createdAt: customer!.createdAt,
        tags: Array.from(new Set([...customer!.tags, ...result.tags])),
      });
    } catch (e) {
      setResearchError((e as Error).message);
    } finally {
      setResearching(false);
    }
  }

  function handleUseInAudience() {
    setSelectedCustomerId(customer!.id);
    router.push("/audience");
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All customers
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {customer.name}
            </h1>
            <div className="text-sm text-muted-foreground mt-0.5">
              {[customer.industry, customer.size, customer.region]
                .filter(Boolean)
                .join(" · ") || "Unspecified"}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge tone={customer.source === "research" ? "primary" : "subtle"}>
                {customer.source === "research" ? "Researched" : "Manual"}
              </Badge>
              {customer.researchedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Researched {new Date(customer.researchedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={handleUseInAudience}>
            <FileSearch className="w-3.5 h-3.5" />
            Use in audience
          </Button>
          <Button
            variant="secondary"
            onClick={handleReresearch}
            disabled={researching}
          >
            {researching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Researching…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Re-research
              </>
            )}
          </Button>
          {!editing && (
            <Button onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </div>
      </header>

      {researchError && (
        <Card className="p-4 mb-4 border-danger/30 bg-danger/[0.05]">
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{researchError}</span>
          </div>
        </Card>
      )}

      {editing ? (
        <Card className="p-5">
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            onDelete={handleDelete}
            warnings={warnings}
            saveLabel="Save customer"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
              Summary
            </div>
            <p className="text-lg leading-relaxed">
              {customer.summary || "No summary yet."}
            </p>
          </Card>

          <CustomerList
            icon={Users}
            title="Known stakeholders"
            items={customer.knownStakeholders}
          />
          <CustomerList
            icon={Flag}
            title="Buying triggers"
            items={customer.buyingTriggers}
          />
          <CustomerList
            icon={Compass}
            title="Evaluation criteria"
            items={customer.evaluationCriteria}
          />
          <CustomerList
            icon={ShieldAlert}
            title="Red flags"
            items={customer.redFlags}
          />
          <CustomerList
            icon={AlertTriangle}
            title="Competitive context"
            items={customer.competitiveContext}
          />
          <CustomerList
            icon={Sparkles}
            title="Notes"
            items={customer.notes}
          />

          {customer.tags.length > 0 && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((t) => (
                  <Badge key={t} tone="subtle">
                    {t}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <EmployeesSection customer={customer} />
        </div>
      )}
    </div>
  );
}

function EmployeesSection({ customer }: { customer: import("@/lib/types").Customer }) {
  const employees = useCustomerEmployees(customer.id);
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const deleteProfile = useProfilerStore((s) => s.deleteProfile);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const grouped = INFLUENCE_LEVELS.map((level) => ({
    level,
    members: employees.filter((p) => p.influence === level).sort(sortByOrgChart),
  }));

  async function discover() {
    setDiscoverError(null);
    setDiscovering(true);
    try {
      const drafts = await researchCustomerStakeholders({ customer });
      // De-dupe by id — research re-runs shouldn't multiply entries
      const existingIds = new Set(employees.map((e) => e.id));
      for (const d of drafts) {
        if (!existingIds.has(d.id)) saveProfile(d);
      }
    } catch (e) {
      setDiscoverError((e as Error).message);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">Employees</h3>
          {employees.length > 0 && (
            <Badge tone="subtle">{employees.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={discover}
            disabled={discovering}
          >
            {discovering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Researching…
              </>
            ) : employees.length === 0 ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Discover stakeholders
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Re-discover
              </>
            )}
          </Button>
          <Link href={`/customers/${customer.id}/employees/new`}>
            <Button size="sm">
              <Plus className="w-3.5 h-3.5" />
              Add employee
            </Button>
          </Link>
        </div>
      </div>

      {discoverError && (
        <div className="rounded-md border border-danger/30 bg-danger/[0.05] p-3 text-sm text-danger flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{discoverError}</span>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
          No employees yet. Run discovery to draft a roster from public sources,
          or add stakeholders manually.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(
            ({ level, members }) =>
              members.length > 0 && (
                <SortableLevelGroup
                  key={level}
                  level={level}
                  members={members}
                  onReorder={(ids) => {
                    ids.forEach((id, idx) => {
                      const m = members.find((mm) => mm.id === id);
                      if (m) saveProfile({ ...m, rankWithinLevel: idx });
                    });
                  }}
                  onRemove={(id) => deleteProfile(id)}
                />
              ),
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Drag rows within a band to rerank seniority.
          </p>
        </div>
      )}
    </Card>
  );
}

function SortableLevelGroup({
  level,
  members,
  onReorder,
  onRemove,
}: {
  level: Person["influence"];
  members: Person[];
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOverId, setDropOverId] = useState<string | null>(null);

  function handleDragStart(id: string) {
    setDragId(id);
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDropOverId(id);
  }
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDropOverId(null);
      return;
    }
    const ids = members.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      setDropOverId(null);
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    setDropOverId(null);
    onReorder(next);
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
        <span className="font-mono">{level}</span>
        <div className="h-px bg-border flex-1" />
        <span className="font-mono">{INFLUENCE_LABELS[level]}</span>
      </div>
      <div className="space-y-1">
        {members.map((p) => (
          <EmployeeRow
            key={p.id}
            person={p}
            dragging={dragId === p.id}
            dropTarget={dropOverId === p.id && dragId !== null && dragId !== p.id}
            onDragStart={() => handleDragStart(p.id)}
            onDragEnd={() => {
              setDragId(null);
              setDropOverId(null);
            }}
            onDragOver={(e) => handleDragOver(e, p.id)}
            onDrop={() => handleDrop(p.id)}
            onRemove={() => onRemove(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function EmployeeRow({
  person,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
}: {
  person: Person;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex items-center gap-3 p-3 rounded-md border transition-colors ${
        dragging ? "opacity-40" : ""
      } ${dropTarget ? "border-primary bg-primary/[0.05]" : "hover:bg-accent/40"}`}
    >
      <span
        className="cursor-grab active:cursor-grabbing text-muted-foreground select-none text-sm leading-none"
        aria-hidden
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
      <Avatar name={person.name} size={36} />
      <Link
        href={`/people/${person.id}`}
        className="flex-1 min-w-0 hover:text-primary"
      >
        <div className="font-medium text-sm truncate">{person.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {person.title}
          {person.team ? ` · ${person.team}` : ""}
        </div>
      </Link>
      {person.source === "research" && (
        <Badge tone="subtle" className="text-[10px]">
          Researched
        </Badge>
      )}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger text-xs transition-opacity"
        aria-label="Remove employee"
      >
        Remove
      </button>
    </div>
  );
}

function CustomerList({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed text-foreground/90 flex gap-2.5"
          >
            <span className="text-muted-foreground mt-1.5 shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

