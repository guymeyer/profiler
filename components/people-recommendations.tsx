"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import {
  scoreRelevantPeople,
  type MatchableArtifact,
} from "@/lib/people-match";

interface Props {
  artifact: MatchableArtifact;
  // Embedded inside a Section (no surrounding card / title)
  hideTitle?: boolean;
  limit?: number;
}

export function PeopleRecommendations({
  artifact,
  hideTitle,
  limit = 5,
}: Props) {
  const people = useEffectivePeople();
  const documents = useProfilerStore((s) => s.documents ?? {});

  const matches = useMemo(
    () =>
      scoreRelevantPeople({
        artifact,
        people,
        corpus: { documents: Object.values(documents) },
        limit,
      }),
    [artifact, people, documents, limit],
  );

  const body = (
    <>
      {matches.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          No connections yet. As people&apos;s profiles get expertise tags or
          they&apos;re linked to adjacent artifacts, suggestions will show up
          here.
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.person.id}>
              <Link
                href={`/people/${m.person.id}`}
                className="flex items-start gap-2.5 -mx-2 px-2 py-1.5 rounded hover:bg-accent transition-colors"
              >
                <Avatar name={m.person.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">
                    {m.person.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {m.person.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.reasons.slice(0, 2).join(" · ")}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (hideTitle) return body;

  // Standalone usage (rare now) — keep a tiny callout shell.
  return (
    <Card variant="plain" className="p-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        People to talk to
      </div>
      {body}
    </Card>
  );
}
