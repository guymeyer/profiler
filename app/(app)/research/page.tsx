"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProfilerStore } from "@/lib/store";

export default function ResearchPage() {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const list = useMemo(
    () =>
      Object.values(documents)
        .filter((d) => d.kind === "research")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of list) for (const t of r.tags) s.add(t);
    return Array.from(s).sort();
  }, [list]);

  const filtered = list.filter((r) => {
    if (r.kind !== "research") return false;
    if (activeTag && !r.tags.includes(activeTag)) return false;
    if (!q.trim()) return true;
    const hay = [
      r.title,
      r.summary,
      r.source,
      r.properties.methodology ?? "",
      r.properties.participants.join(" "),
      r.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
          <p className="text-muted-foreground mt-1">
            Official research from the team — interviews, studies, primary
            sources. Inject into an analysis to ground recommendations in
            evidence stakeholders can&apos;t easily dismiss.
          </p>
        </div>
        <Link href="/research/new">
          <Button>
            <Plus className="w-3.5 h-3.5" />
            Add research
          </Button>
        </Link>
      </header>

      {!hydrated ? null : list.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No research yet</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Upload an interview transcript, study, or research summary. Tag it,
            link it to relevant people or customers, then pick it as evidence
            when running analyses.
          </p>
          <Link href="/research/new">
            <Button>
              <Plus className="w-3.5 h-3.5" />
              Add research
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
                placeholder="Search title, source, methodology, participants…"
                className="pl-9"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveTag(null)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                    activeTag === null
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  All
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTag(t === activeTag ? null : t)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                      activeTag === t
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-lg">
              No research matches those filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((r) => (
                <Link key={r.id} href={`/documents/${r.id}`}>
                  <Card className="p-5 hover:border-primary/30 hover:shadow-sm transition-all h-full">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold leading-tight line-clamp-2">
                        {r.title}
                      </h3>
                      <BookOpen className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-2">
                      {r.source}
                      {r.kind === "research" && r.properties.conductedAt
                        ? ` · ${new Date(r.properties.conductedAt).toLocaleDateString(
                            undefined,
                            { year: "numeric", month: "short" },
                          )}`
                        : ""}
                    </div>
                    {r.summary && (
                      <p className="text-sm text-foreground/80 line-clamp-3 mb-3">
                        {r.summary}
                      </p>
                    )}
                    {(r.tags.length > 0 ||
                      (r.kind === "research" && r.properties.participants.length > 0) ||
                      r.linkedPersonIds.length > 0 ||
                      r.linkedCustomerIds.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {r.tags.slice(0, 4).map((t) => (
                          <Badge key={t} tone="subtle" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        {r.linkedPersonIds.length > 0 && (
                          <Badge tone="neutral" className="text-[10px]">
                            {r.linkedPersonIds.length} people
                          </Badge>
                        )}
                        {r.linkedCustomerIds.length > 0 && (
                          <Badge tone="neutral" className="text-[10px]">
                            {r.linkedCustomerIds.length} customers
                          </Badge>
                        )}
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
