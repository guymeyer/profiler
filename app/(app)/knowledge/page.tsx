"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  InlineDatabase,
  DbDate,
  type InlineDatabaseColumn,
} from "@/components/ui/inline-database";
import { cn } from "@/lib/utils";
import { useProfilerStore } from "@/lib/store";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import {
  MEMO_KIND_LABELS,
  PRD_STATUS_LABELS,
  type Document,
} from "@/lib/types";

type Kind = "research" | "prd" | "memo" | "microsite" | "deck";

interface KnowledgeRow {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  source?: string;
  status?: string;
  tags: string[];
  buName?: string;
  createdAt: string;
  href: string;
}

const KIND_LABELS: Record<Kind, string> = {
  research: "Research",
  prd: "PRD",
  memo: "Memo",
  microsite: "Synthesis",
  deck: "Deck",
};

export default function KnowledgeListPage() {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const [activeKind, setActiveKind] = useState<Kind | null>(null);

  const rows: KnowledgeRow[] = useMemo(() => {
    const out: KnowledgeRow[] = [];
    for (const d of Object.values(documents) as Document[]) {
      if (d.kind === "research") {
        out.push({
          id: d.id,
          kind: "research",
          title: d.title,
          summary: d.summary,
          source: d.source,
          tags: d.tags,
          createdAt: d.createdAt,
          href: `/documents/${d.id}`,
        });
      } else if (d.kind === "prd") {
        out.push({
          id: d.id,
          kind: "prd",
          title: d.title,
          summary: d.summary,
          source: d.source,
          status: PRD_STATUS_LABELS[d.properties.status],
          tags: d.tags,
          buName: d.linkedBusinessUnitId
            ? bus[d.linkedBusinessUnitId]?.name
            : undefined,
          createdAt: d.createdAt,
          href: `/documents/${d.id}`,
        });
      } else if (d.kind === "memo") {
        out.push({
          id: d.id,
          kind: "memo",
          title: d.title,
          summary: d.summary,
          source: d.source,
          status: MEMO_KIND_LABELS[d.properties.memoKind],
          tags: d.tags,
          buName: d.linkedBusinessUnitId
            ? bus[d.linkedBusinessUnitId]?.name
            : undefined,
          createdAt: d.createdAt,
          href: `/documents/${d.id}`,
        });
      } else if (d.kind === "microsite") {
        // Microsites render in their bespoke viewer at /synthesis/[id]
        // rather than the unified Document detail page.
        out.push({
          id: d.id,
          kind: "microsite",
          title: d.title,
          summary: `Synthesis across ${d.properties.researchIds.length} research source${d.properties.researchIds.length === 1 ? "" : "s"}`,
          source: d.properties.model ?? d.properties.generatedBy,
          tags: d.tags,
          createdAt: d.createdAt,
          href: `/synthesis/${d.id}`,
        });
      } else if (d.kind === "deck") {
        out.push({
          id: d.id,
          kind: "deck",
          title: d.title,
          summary: `${d.properties.slides.length} slide${d.properties.slides.length === 1 ? "" : "s"}`,
          source: d.properties.model ?? d.properties.generatedBy,
          tags: d.tags,
          createdAt: d.createdAt,
          href: `/synthesis/${d.properties.synthesisId}/decks/${d.id}`,
        });
      }
    }
    return out.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [documents, bus]);

  const filtered = rows.filter((r) => {
    if (activeKind && r.kind !== activeKind) return false;
    if (!q.trim()) return true;
    const hay = [r.title, r.summary, r.source ?? "", r.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const counts: Record<Kind, number> = useMemo(() => {
    const init: Record<Kind, number> = {
      research: 0,
      prd: 0,
      memo: 0,
      microsite: 0,
      deck: 0,
    };
    for (const d of Object.values(documents)) {
      if (d.kind in init) {
        init[d.kind as Kind] += 1;
      }
    }
    return init;
  }, [documents]);

  const columns: InlineDatabaseColumn<KnowledgeRow>[] = [
    {
      key: "kind",
      label: "Kind",
      kind: "badge",
      width: "w-[80px]",
      render: (r) => (
        <span className="text-[12px] text-muted-foreground">
          {KIND_LABELS[r.kind]}
        </span>
      ),
      sortValue: (r) => r.kind,
    },
    {
      key: "title",
      label: "Title",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-foreground font-medium">{r.title}</div>
          {r.summary && (
            <div className="text-muted-foreground text-[12px] line-clamp-1 mt-0.5">
              {r.summary}
            </div>
          )}
        </div>
      ),
      sortValue: (r) => r.title,
    },
    {
      key: "status",
      label: "Status",
      kind: "muted",
      width: "w-[120px]",
      render: (r) => r.status ?? "",
      sortValue: (r) => r.status ?? "",
    },
    {
      key: "bu",
      label: "BU",
      kind: "muted",
      width: "w-[140px]",
      render: (r) => r.buName ?? "",
      sortValue: (r) => r.buName ?? "",
    },
    {
      key: "tags",
      label: "Tags",
      width: "w-[200px]",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.tags.slice(0, 3).map((t) => (
            <Badge key={t} tone="subtle">
              {t}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Added",
      kind: "date",
      width: "w-[140px]",
      render: (r) => <DbDate iso={r.createdAt} />,
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Knowledge"
        meta={
          <>
            Everything the team has captured — research, PRDs, memos. Each
            kind keeps its own detail page; this is the one place to find
            anything.
          </>
        }
        actions={
          <Link href="/knowledge/new">
            <Button>Add to Knowledge</Button>
          </Link>
        }
      />

      {!hydrated ? null : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-6">
            <div className="relative max-w-md">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles, summaries, owners, tags…"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <KindChip
                label={`All · ${rows.length}`}
                active={activeKind === null}
                onClick={() => setActiveKind(null)}
              />
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <KindChip
                  key={k}
                  label={`${KIND_LABELS[k]} · ${counts[k]}`}
                  active={activeKind === k}
                  onClick={() => setActiveKind(activeKind === k ? null : k)}
                />
              ))}
            </div>
          </div>

          <Section title={undefined}>
            <InlineDatabase
              rows={filtered}
              columns={columns}
              rowHref={(r) => r.href}
              emptyLabel="Nothing matches those filters."
            />
          </Section>
        </>
      )}
    </div>
  );
}

function KindChip({
  label,
  active,
  onClick,
}: {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[12px] transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-md p-10 text-center">
      <h2 className="font-semibold mb-1">Knowledge repository is empty</h2>
      <p className="text-[13px] text-muted-foreground mb-4 max-w-md mx-auto">
        Drop in anything — interview, PRD, strategy memo. Claude classifies
        and files it where it belongs.
      </p>
      <Link href="/knowledge/new">
        <Button>Add to Knowledge</Button>
      </Link>
      <div className="mt-4 text-[11px] text-muted-foreground">
        Prefer to pick the kind yourself?{" "}
        <Link href="/research/new" className="link">
          Research
        </Link>
        {" · "}
        <Link href="/prds/new" className="link">
          PRD
        </Link>
        {" · "}
        <Link href="/memos/new" className="link">
          Memo
        </Link>
      </div>
    </div>
  );
}
