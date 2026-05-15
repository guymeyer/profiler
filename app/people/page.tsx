"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PersonCard } from "@/components/people/person-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInternalPeople } from "@/lib/people-hooks";
import { useProfilerStore } from "@/lib/store";
import { PEOPLE } from "@/lib/data/people";

export default function PeoplePage() {
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const people = useInternalPeople();
  const customProfiles = useProfilerStore((s) => s.customProfiles ?? {});

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of people) for (const t of p.tags) s.add(t);
    return Array.from(s).sort();
  }, [people]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return people.filter((p) => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (!term) return true;
      const hay = [p.name, p.title, p.team, p.summary, ...p.tags]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [people, q, activeTag]);

  const customCount = Object.values(customProfiles).filter(
    (c) => !PEOPLE.some((seed) => seed.id === c.id),
  ).length;
  const overrideCount = Object.values(customProfiles).filter((c) =>
    PEOPLE.some((seed) => seed.id === c.id),
  ).length;

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            People directory
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse profiles for the people whose decisions you need to win.
          </p>
        </div>
        <Link href="/people/new">
          <Button>
            <Plus className="w-3.5 h-3.5" />
            New person
          </Button>
        </Link>
      </header>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, title, team, or tag…"
            className="pl-9"
          />
        </div>
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
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-lg">
          No people match those filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PersonCard key={p.id} person={p} />
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        Showing {filtered.length} of {people.length} profiles ·{" "}
        <Badge tone="subtle">prototype data</Badge>
        {(customCount > 0 || overrideCount > 0) && (
          <span className="ml-2">
            · {customCount} custom · {overrideCount} edited
          </span>
        )}
      </div>
    </div>
  );
}
