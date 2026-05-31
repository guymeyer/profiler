"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { usePeopleByCompany, INFLUENCE_LABELS, sortByOrgChart } from "@/lib/people-hooks";

// People scoped to a single Company. Used inside both /company/people and
// /customers/[id]/people via the shared <CompanyDetailShell>.

interface Props {
  companyId: string;
  addHref: string;
}

export function PeopleSection({ companyId, addHref }: Props) {
  const people = usePeopleByCompany(companyId);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? people.filter((p) =>
          [p.name, p.title, p.team, p.summary, ...p.tags]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : people;
    return [...list].sort(sortByOrgChart);
  }, [people, q]);

  return (
    <Section
      title="People"
      subtitle={`${people.length} on file`}
      trailing={
        <Link href={addHref}>
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            Add person
          </Button>
        </Link>
      }
    >
      <div className="max-w-md mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, title, team, or tag…"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          {people.length === 0
            ? "No one's been added yet. Use the button above to add a profile."
            : "Nothing matches that filter."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                className="flex items-start gap-3 border border-border rounded-md p-3 hover:bg-accent/40 transition-colors"
              >
                <Avatar name={p.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">
                    {p.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {p.title}
                    {p.team ? ` · ${p.team}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {INFLUENCE_LABELS[p.influence]}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
