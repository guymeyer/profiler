"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  InlineDatabase,
  type InlineDatabaseColumn,
} from "@/components/ui/inline-database";
import { useInternalPeople } from "@/lib/people-hooks";
import { useProfilerStore } from "@/lib/store";
import { PEOPLE } from "@/lib/data/people";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const columns: InlineDatabaseColumn<Person>[] = [
    {
      key: "name",
      label: "Name",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={p.name} size={24} />
          <span className="font-medium text-foreground">{p.name}</span>
        </div>
      ),
      sortValue: (p) => p.name,
    },
    {
      key: "title",
      label: "Title",
      kind: "muted",
      render: (p) => p.title,
      sortValue: (p) => p.title,
    },
    {
      key: "team",
      label: "Team",
      kind: "muted",
      width: "w-[200px]",
      render: (p) => p.team,
      sortValue: (p) => p.team,
    },
    {
      key: "influence",
      label: "Influence",
      kind: "muted",
      width: "w-[100px]",
      render: (p) => p.influence,
      sortValue: (p) => p.influence,
    },
    {
      key: "tags",
      label: "Tags",
      width: "w-[180px]",
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.tags.slice(0, 3).map((t) => (
            <Badge key={t} tone="subtle">
              {t}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="People"
        meta={
          <>
            {people.length} {people.length === 1 ? "profile" : "profiles"}
            {overrideCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {overrideCount} edited
              </span>
            )}
            {customCount > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · {customCount} custom
              </span>
            )}
          </>
        }
        actions={
          <Link href="/people/new">
            <Button>New person</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 mb-6">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, title, team, tags…"
          className="max-w-md"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <TagChip
              label="All"
              active={activeTag === null}
              onClick={() => setActiveTag(null)}
            />
            {allTags.map((t) => (
              <TagChip
                key={t}
                label={t}
                active={activeTag === t}
                onClick={() => setActiveTag(t === activeTag ? null : t)}
              />
            ))}
          </div>
        )}
      </div>

      <InlineDatabase
        rows={filtered}
        columns={columns}
        rowHref={(p) => `/people/${p.id}`}
        emptyLabel="No matching people."
      />
    </div>
  );
}

function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
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
