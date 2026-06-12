"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProfilerStore } from "@/lib/store";
import { PRD_STATUS_LABELS, type PRDStatus } from "@/lib/types";

const STATUS_TONE: Record<PRDStatus, "subtle" | "neutral" | "success"> = {
  draft: "subtle",
  review: "neutral",
  approved: "neutral",
  shipped: "success",
};

export default function PRDsListPage() {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [q, setQ] = useState("");
  const [activeStatus, setActiveStatus] = useState<PRDStatus | null>(null);

  const list = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.kind === "prd")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents],
  );

  const filtered = list.filter((p) => {
    if (p.kind !== "prd") return false;
    if (activeStatus && p.properties.status !== activeStatus) return false;
    if (!q.trim()) return true;
    const hay = [
      p.title,
      p.summary,
      p.properties.problem,
      p.properties.solution,
      p.source ?? "",
      p.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const allStatuses: PRDStatus[] = ["draft", "review", "approved", "shipped"];

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PRDs</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Product requirements documents — the team&apos;s planned intent.
            Sits next to research on BU dashboards so observed reality and
            planned scope read side-by-side. Success metrics auto-extract as
            target metrics.
          </p>
        </div>
        <Link href="/prds/new">
          <Button>
            <Plus className="w-3.5 h-3.5" />
            Add PRD
          </Button>
        </Link>
      </header>

      {!hydrated ? null : list.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No PRDs yet</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Upload a PRD or paste one in. Claude auto-extracts problem,
            solution, target users, success metrics, and status.
          </p>
          <Link href="/prds/new">
            <Button>
              <Plus className="w-3.5 h-3.5" />
              Add PRD
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-6">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, problem, solution, owner…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveStatus(null)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                  activeStatus === null
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setActiveStatus(s === activeStatus ? null : s)
                  }
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                    activeStatus === s
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PRD_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-lg">
              No PRDs match those filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => {
                if (p.kind !== "prd") return null;
                const bu = p.linkedBusinessUnitId
                  ? bus[p.linkedBusinessUnitId]
                  : undefined;
                return (
                  <Link key={p.id} href={`/documents/${p.id}`}>
                    <Card className="p-5 hover:border-primary/30 hover:shadow-sm transition-all h-full">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold leading-tight line-clamp-2">
                          {p.title}
                        </h3>
                        <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                      <div className="text-[11px] text-muted-foreground mb-2">
                        {p.source ?? "Owner unknown"}
                        {p.properties.targetShipDate &&
                          ` · ship ${new Date(p.properties.targetShipDate).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`}
                      </div>
                      {p.summary && (
                        <p className="text-sm text-foreground/80 line-clamp-3 mb-3">
                          {p.summary}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={STATUS_TONE[p.properties.status]} className="text-[10px]">
                          {PRD_STATUS_LABELS[p.properties.status]}
                        </Badge>
                        {bu && (
                          <Badge tone="neutral" className="text-[10px]">
                            {bu.name}
                          </Badge>
                        )}
                        {p.properties.successMetrics.length > 0 && (
                          <Badge tone="subtle" className="text-[10px]">
                            {p.properties.successMetrics.length} target metric
                            {p.properties.successMetrics.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {p.tags.slice(0, 3).map((t) => (
                          <Badge key={t} tone="subtle" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
