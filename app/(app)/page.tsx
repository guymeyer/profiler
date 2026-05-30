"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfilerStore } from "@/lib/store";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function HomePage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const recents = useProfilerStore((s) => s.recentResults);
  const saved = useProfilerStore((s) => s.savedAudiences);

  const featured = PEOPLE.slice(0, 4);

  return (
    <div>
      <PageHeader
        eyebrow="Profiler · audience intelligence"
        title="Present work to the people who decide."
        meta={
          <>
            Open a profile to see how a person prefers work framed, reviewed,
            and communicated. Drop in an artifact and get sharp, specific
            recommendations on how to land it.
          </>
        }
        actions={
          <>
            <Link href="/analyze">
              <Button>Analyze an artifact</Button>
            </Link>
            <Link href="/audience">
              <Button variant="secondary">Build audience</Button>
            </Link>
          </>
        }
      />

      <Section
        title="Featured profiles"
        trailing={
          <Link
            href="/people"
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            All people →
          </Link>
        }
      >
        <ul className="divide-y divide-border">
          {featured.map((p) => (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-accent transition-colors"
              >
                <Avatar name={p.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium leading-tight">
                    {p.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {p.title} · {p.team}
                  </div>
                </div>
                <div className="hidden md:block text-[12px] text-muted-foreground truncate max-w-md">
                  {p.summary}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Objectives"
        subtitle={`${OBJECTIVES.length} on file`}
        divider
        trailing={
          <Link
            href="/objectives"
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            All →
          </Link>
        }
      >
        <ul className="divide-y divide-border">
          {OBJECTIVES.slice(0, 5).map((o) => (
            <li key={o.id} className="py-2.5">
              <div className="text-[14px] font-medium">{o.title}</div>
              <div className="text-[12px] text-muted-foreground line-clamp-1">
                {o.description}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent analyses" divider>
        {!hydrated || recents.length === 0 ? (
          <EmptyLine
            text="No analyses yet."
            cta={{ href: "/analyze", label: "Analyze an artifact" }}
          />
        ) : (
          <ul className="divide-y divide-border">
            {recents.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/results/${r.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium leading-tight truncate">
                      {r.title}
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      {r.personIds
                        .map(
                          (id) =>
                            PEOPLE.find((p) => p.id === id)?.name.split(
                              " ",
                            )[0],
                        )
                        .filter(Boolean)
                        .join(", ")}
                      {r.objectiveIds.length > 0 &&
                        ` · ${r.objectiveIds.length} ${
                          r.objectiveIds.length === 1
                            ? "objective"
                            : "objectives"
                        }`}
                    </div>
                  </div>
                  <div className="text-[12px] text-muted-foreground tabular-nums">
                    Fit {r.fitScore}/100
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Saved audiences" divider>
        {!hydrated || saved.length === 0 ? (
          <EmptyLine
            text="No saved audiences."
            cta={{ href: "/audience", label: "Build an audience" }}
          />
        ) : (
          <ul className="divide-y divide-border">
            {saved.slice(0, 5).map((a) => (
              <li key={a.id} className="py-2.5">
                <Link
                  href="/audience"
                  className="text-[14px] font-medium hover:text-primary transition-colors"
                >
                  {a.name}
                </Link>
                <div className="text-[12px] text-muted-foreground">
                  {a.personIds.length} people · {a.objectiveIds.length}{" "}
                  objectives
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function EmptyLine({
  text,
  cta,
}: {
  text: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="text-[13px] text-muted-foreground">
      {text}{" "}
      <Link href={cta.href} className="link">
        {cta.label}
      </Link>
      .
    </div>
  );
}
