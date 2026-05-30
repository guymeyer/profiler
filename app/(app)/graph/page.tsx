"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { OBJECTIVES } from "@/lib/data/objectives";
import {
  ForceGraph,
  type GraphEdge,
  type GraphNode,
} from "@/components/graph/force-graph";
import { DOCUMENT_KIND_LABELS, type Document } from "@/lib/types";
import { cn } from "@/lib/utils";

// Visualizes the whole knowledge graph. Every document, person, customer,
// objective, and business unit becomes a node. Edges come from the
// document's linked-* fields plus any @-mentions parsed from the body.
//
// Tags aren't first-class nodes (they're a fuzzy classifier rather than
// a discrete entity); we treat them as document properties for filtering
// only. Add a tag-node mode later if useful.

type NodeKind =
  | "document"
  | "person"
  | "customer"
  | "objective"
  | "business-unit";

const KIND_COLOR: Record<NodeKind, string> = {
  document: "var(--primary)",
  person: "#10b981",
  customer: "#f59e0b",
  objective: "#8b5cf6",
  "business-unit": "#ef4444",
};

const KIND_LABEL: Record<NodeKind, string> = {
  document: "Document",
  person: "Person",
  customer: "Customer",
  objective: "Objective",
  "business-unit": "Business unit",
};

export default function GraphPage() {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const customers = useProfilerStore((s) => s.customers ?? {});
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const people = useEffectivePeople();
  const hydrated = useHydrated();

  const [activeKinds, setActiveKinds] = useState<Set<NodeKind>>(
    new Set(Object.keys(KIND_LABEL) as NodeKind[]),
  );
  const [query, setQuery] = useState("");

  const { nodes, edges, counts } = useMemo(() => {
    if (!hydrated) {
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[], counts: { document: 0, person: 0, customer: 0, objective: 0, "business-unit": 0 } };
    }
    const ns: GraphNode[] = [];
    const es: GraphEdge[] = [];
    const counts = {
      document: 0,
      person: 0,
      customer: 0,
      objective: 0,
      "business-unit": 0,
    };

    // People
    for (const p of people) {
      if (!activeKinds.has("person")) break;
      ns.push({
        id: `node-person-${p.id}`,
        label: p.name,
        kind: "person",
        href: `/people/${p.id}`,
      });
      counts.person += 1;
    }

    // Customers
    if (activeKinds.has("customer")) {
      for (const c of Object.values(customers)) {
        ns.push({
          id: `node-customer-${c.id}`,
          label: c.name,
          kind: "customer",
          href: `/customers/${c.id}`,
        });
        counts.customer += 1;
      }
    }

    // Objectives
    if (activeKinds.has("objective")) {
      for (const o of OBJECTIVES) {
        ns.push({
          id: `node-objective-${o.id}`,
          label: o.title,
          kind: "objective",
          href: `/objectives/${o.id}`,
        });
        counts.objective += 1;
      }
    }

    // Business units
    if (activeKinds.has("business-unit")) {
      for (const b of Object.values(businessUnits)) {
        ns.push({
          id: `node-bu-${b.id}`,
          label: b.name,
          kind: "business-unit",
          href: `/business-units/${b.id}`,
        });
        counts["business-unit"] += 1;
      }
    }

    // Documents + their edges
    const docList = Object.values(documents) as Document[];
    for (const d of docList) {
      if (activeKinds.has("document")) {
        ns.push({
          id: `node-doc-${d.id}`,
          label: d.title,
          kind: "document",
          href: `/documents/${d.id}`,
        });
        counts.document += 1;
      }

      // Edges always pull from the document side. If documents are
      // filtered out, skip — otherwise we'd render orphan edges.
      if (!activeKinds.has("document")) continue;

      for (const pid of d.linkedPersonIds) {
        if (activeKinds.has("person")) {
          es.push({ source: `node-doc-${d.id}`, target: `node-person-${pid}` });
        }
      }
      for (const cid of d.linkedCustomerIds) {
        if (activeKinds.has("customer")) {
          es.push({ source: `node-doc-${d.id}`, target: `node-customer-${cid}` });
        }
      }
      for (const oid of d.linkedObjectiveIds) {
        if (activeKinds.has("objective")) {
          es.push({ source: `node-doc-${d.id}`, target: `node-objective-${oid}` });
        }
      }
      if (d.linkedBusinessUnitId && activeKinds.has("business-unit")) {
        es.push({
          source: `node-doc-${d.id}`,
          target: `node-bu-${d.linkedBusinessUnitId}`,
        });
      }
      // @-mention chips → other documents (parsed from body markdown).
      for (const targetId of extractMentionedDocumentIds(d.content, docList)) {
        es.push({ source: `node-doc-${d.id}`, target: `node-doc-${targetId}` });
      }
      // Microsite → research source documents.
      if (d.kind === "microsite") {
        for (const rid of d.properties.researchIds) {
          es.push({ source: `node-doc-${d.id}`, target: `node-doc-${rid}` });
        }
      }
      // Deck → its parent microsite.
      if (d.kind === "deck") {
        es.push({
          source: `node-doc-${d.id}`,
          target: `node-doc-${d.properties.synthesisId}`,
        });
      }
    }
    return { nodes: ns, edges: es, counts };
  }, [
    hydrated,
    activeKinds,
    people,
    customers,
    businessUnits,
    documents,
  ]);

  function toggleKind(k: NodeKind) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const lowerQuery = query.trim().toLowerCase();
  const isDimmed = lowerQuery
    ? (n: GraphNode) => !n.label.toLowerCase().includes(lowerQuery)
    : undefined;

  return (
    <div>
      <PageHeader
        title="Graph"
        meta="Everything that links to anything else. Click any node to open its detail page; hover to see direct neighbors."
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="max-w-xs flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by label…"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => {
            const active = activeKinds.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: KIND_COLOR[k] }}
                />
                {KIND_LABEL[k]} · {counts[k]}
              </button>
            );
          })}
        </div>
      </div>

      {!hydrated ? null : nodes.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nothing to graph yet — add a document, then come back.
        </Card>
      ) : (
        <Card className="p-2 overflow-hidden">
          <ForceGraph
            nodes={nodes}
            edges={edges}
            colorByKind={KIND_COLOR}
            isDimmed={isDimmed}
          />
        </Card>
      )}
    </div>
  );
}

// Parse @[Label](id) chips out of the markdown body and return the ids
// that match other documents in the corpus. Filters by id so we don't
// emit edges to people/customers from this pass — those go through the
// document's linked-* fields above.
function extractMentionedDocumentIds(body: string, docs: Document[]): string[] {
  if (!body) return [];
  const docIds = new Set(docs.map((d) => d.id));
  const out = new Set<string>();
  const re = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (docIds.has(m[1])) out.add(m[1]);
  }
  return Array.from(out);
}
