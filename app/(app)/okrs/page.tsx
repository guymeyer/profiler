"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Flag,
  Building2,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { slugifyId } from "@/lib/profile-md";
import type { BusinessUnit, OKR, OKRStatus } from "@/lib/types";

const STATUS_TONE: Record<OKRStatus, "success" | "warning" | "danger" | "subtle"> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
  achieved: "subtle",
};

export default function OKRsPage() {
  const okrs = useProfilerStore((s) => s.okrs ?? {});
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const okrList = useMemo(
    () =>
      Object.values(okrs).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [okrs],
  );

  const companyOkrs = okrList.filter((o) => o.level === "company");
  const buGroups = Object.values(bus)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bu) => ({
      bu,
      okrs: okrList.filter((o) => o.businessUnitId === bu.id),
    }));
  const orphaned = okrList.filter(
    (o) => o.level === "bu" && (!o.businessUnitId || !bus[o.businessUnitId]),
  );

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OKRs</h1>
          <p className="text-muted-foreground mt-1">
            Company and business-unit OKRs. Attach people so recommendations
            automatically advance the objectives the audience owns.
          </p>
        </div>
        <Link href="/okrs/new">
          <Button>
            <Plus className="w-3.5 h-3.5" />
            Add OKR
          </Button>
        </Link>
      </header>

      {!hydrated ? null : (
        <div className="space-y-6">
          <BusinessUnitsCard />

          <Section
            title="Company-level"
            icon={Flag}
            okrs={companyOkrs}
            emptyHint="No company-level OKRs yet."
          />

          {buGroups.map(({ bu, okrs }) => (
            <Section
              key={bu.id}
              title={bu.name}
              icon={Building2}
              subtitle={bu.description}
              okrs={okrs}
              emptyHint={`No OKRs for ${bu.name} yet.`}
            />
          ))}

          {orphaned.length > 0 && (
            <Section
              title="Unassigned BU OKRs"
              icon={Flag}
              okrs={orphaned}
              emptyHint=""
            />
          )}

          {okrList.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <Flag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-semibold mb-1">No OKRs defined yet</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Define a Business Unit first (if you need one), then add OKRs
                under it or at the company level.
              </p>
              <Link href="/okrs/new">
                <Button>
                  <Plus className="w-3.5 h-3.5" />
                  Add OKR
                </Button>
              </Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  subtitle,
  okrs,
  emptyHint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  okrs: OKR[];
  emptyHint: string;
}) {
  if (okrs.length === 0 && !emptyHint) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground ml-1">
            · {subtitle}
          </span>
        )}
      </div>
      {okrs.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4">
          {emptyHint}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {okrs.map((o) => (
            <OKRCard key={o.id} okr={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OKRCard({ okr }: { okr: OKR }) {
  const people = useEffectivePeople();
  const owners = people.filter((p) => okr.ownerPersonIds.includes(p.id));
  const attached = people.filter((p) =>
    okr.attachedPersonIds.includes(p.id),
  );
  return (
    <Link href={`/okrs/${okr.id}`}>
      <Card className="p-4 hover:border-primary/30 hover:shadow-sm transition-all h-full">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold leading-tight">{okr.objective}</h3>
          {okr.status && (
            <Badge tone={STATUS_TONE[okr.status]} className="text-[10px] shrink-0">
              {okr.status.replace("-", " ")}
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mb-2">
          {okr.timeframe}
        </div>
        {okr.keyResults.length > 0 && (
          <ul className="space-y-1 mb-2">
            {okr.keyResults.slice(0, 3).map((kr, i) => (
              <li key={i} className="text-xs flex gap-2 text-foreground/80">
                <span className="text-muted-foreground">KR{i + 1}</span>
                <span className="line-clamp-2">{kr}</span>
              </li>
            ))}
            {okr.keyResults.length > 3 && (
              <li className="text-[11px] text-muted-foreground italic">
                +{okr.keyResults.length - 3} more
              </li>
            )}
          </ul>
        )}
        {(owners.length > 0 || attached.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            {owners.map((p) => (
              <Badge key={p.id} tone="primary" className="text-[10px]">
                Owner: {p.name.split(" ")[0]}
              </Badge>
            ))}
            {attached
              .filter((p) => !okr.ownerPersonIds.includes(p.id))
              .slice(0, 3)
              .map((p) => (
                <Badge key={p.id} tone="subtle" className="text-[10px]">
                  {p.name.split(" ")[0]}
                </Badge>
              ))}
          </div>
        )}
      </Card>
    </Link>
  );
}

function BusinessUnitsCard() {
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const saveBU = useProfilerStore((s) => s.saveBusinessUnit);
  const deleteBU = useProfilerStore((s) => s.deleteBusinessUnit);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = Object.values(bus).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold tracking-tight">Business Units</h2>
          {list.length > 0 && (
            <Badge tone="subtle" className="text-[10px]">
              {list.length}
            </Badge>
          )}
        </div>
        {!adding && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            New BU
          </Button>
        )}
      </div>

      {list.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No business units yet. Add one to attach BU-level OKRs.
        </p>
      )}

      <div className="space-y-2">
        {list.map((bu) =>
          editingId === bu.id ? (
            <BUForm
              key={bu.id}
              initial={bu}
              onSubmit={(b) => {
                saveBU(b);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
              onDelete={() => {
                deleteBU(bu.id);
                setEditingId(null);
              }}
            />
          ) : (
            <div
              key={bu.id}
              className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent/40 group"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{bu.name}</div>
                {bu.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {bu.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditingId(bu.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-xs transition-opacity inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
          ),
        )}

        {adding && (
          <BUForm
            onSubmit={(b) => {
              saveBU(b);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </Card>
  );
}

function BUForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: BusinessUnit;
  onSubmit: (bu: BusinessUnit) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const people = useEffectivePeople();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [leaderPersonId, setLeaderPersonId] = useState(
    initial?.leaderPersonId ?? "",
  );

  function handleSave() {
    const id = initial?.id ?? `bu_${slugifyId(name) || Date.now().toString(36)}`;
    onSubmit({
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      leaderPersonId: leaderPersonId || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-md border p-3 bg-surface/40 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="BU name — e.g. Platform"
        />
        <select
          value={leaderPersonId}
          onChange={(e) => setLeaderPersonId(e.target.value)}
          className="text-sm rounded-md border bg-background px-3 py-1.5"
        >
          <option value="">Leader (optional)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.title}
            </option>
          ))}
        </select>
      </div>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description — what this BU is responsible for"
      />
      <div className="flex items-center justify-end gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs text-muted-foreground hover:text-danger mr-auto inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
          <Check className="w-3.5 h-3.5" />
          {initial ? "Save" : "Create BU"}
        </Button>
      </div>
    </div>
  );
}
