"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useProfilerStore } from "@/lib/store";

// Backlinks: the inverse of the linked-people/customers/objectives lists
// that already exist on each artifact. Given an entity (person / customer
// / objective / BU), shows every Knowledge artifact (research / PRD /
// memo / synthesis) that references it. Pure graph traversal — no LLM.
//
// Embed inside a <Section title="References">; this component renders the
// list inline with no chrome of its own.

export type BacklinkEntity =
  | { kind: "person"; id: string }
  | { kind: "customer"; id: string }
  | { kind: "objective"; id: string }
  | { kind: "business-unit"; id: string };

interface BacklinkItem {
  kind: "research" | "prd" | "memo" | "synthesis";
  id: string;
  title: string;
  href: string;
  source?: string;
}

const KIND_LABELS: Record<BacklinkItem["kind"], string> = {
  research: "Research",
  prd: "PRD",
  memo: "Memo",
  synthesis: "Synthesis",
};

export function Backlinks({
  entity,
  limit = 8,
  emptyLabel = "Nothing in the Knowledge repository references this yet.",
}: {
  entity: BacklinkEntity;
  limit?: number;
  emptyLabel?: string;
}) {
  const documents = useProfilerStore((s) => s.documents ?? {});

  const items: BacklinkItem[] = useMemo(() => {
    const out: BacklinkItem[] = [];

    for (const d of Object.values(documents)) {
      if (d.kind === "research" || d.kind === "prd" || d.kind === "memo") {
        if (matches(d, entity)) {
          out.push({
            kind: d.kind,
            id: d.id,
            title: d.title,
            href: `/documents/${d.id}`,
            source: d.source,
          });
        }
      } else if (d.kind === "microsite") {
        // Microsites match transitively via their source research docs.
        const sourceResearch = d.properties.researchIds
          .map((rid) => documents[rid])
          .filter(Boolean);
        const hit = sourceResearch.some((r) => matches(r, entity));
        if (hit) {
          out.push({
            kind: "synthesis",
            id: d.id,
            title: d.title,
            href: `/synthesis/${d.id}`,
          });
        }
      }
    }

    return out;
  }, [documents, entity]);

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">{emptyLabel}</p>
    );
  }

  const grouped = groupByKind(items);

  return (
    <div className="space-y-5">
      {(Object.keys(KIND_LABELS) as BacklinkItem["kind"][]).map((kind) => {
        const list = grouped[kind] ?? [];
        if (list.length === 0) return null;
        const label = KIND_LABELS[kind];
        const shown = list.slice(0, limit);
        return (
          <div key={kind}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              {label} · {list.length}
            </div>
            <ul className="space-y-1">
              {shown.map((it) => (
                <li key={`${it.kind}-${it.id}`}>
                  <Link
                    href={it.href}
                    className="block text-[13px] hover:bg-accent rounded px-2 py-1 -mx-2 transition-colors"
                  >
                    <span className="text-foreground">{it.title}</span>
                    {it.source && (
                      <span className="text-muted-foreground ml-2">
                        · {it.source}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {list.length > limit && (
              <div className="text-[11px] text-muted-foreground mt-1 px-2">
                +{list.length - limit} more
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MatchableLinks {
  linkedPersonIds?: string[];
  linkedCustomerIds?: string[];
  linkedObjectiveIds?: string[];
  linkedBusinessUnitId?: string;
}

function matches(item: MatchableLinks, entity: BacklinkEntity): boolean {
  if (entity.kind === "person") {
    return (item.linkedPersonIds ?? []).includes(entity.id);
  }
  if (entity.kind === "customer") {
    return (item.linkedCustomerIds ?? []).includes(entity.id);
  }
  if (entity.kind === "objective") {
    return (item.linkedObjectiveIds ?? []).includes(entity.id);
  }
  return item.linkedBusinessUnitId === entity.id;
}

function groupByKind(
  items: BacklinkItem[],
): Partial<Record<BacklinkItem["kind"], BacklinkItem[]>> {
  const map: Partial<Record<BacklinkItem["kind"], BacklinkItem[]>> = {};
  for (const i of items) {
    const arr = map[i.kind];
    if (arr) arr.push(i);
    else map[i.kind] = [i];
  }
  return map;
}
