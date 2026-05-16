"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileSearch,
  UsersRound,
  ArrowRight,
  Sparkles,
  Clock,
  Users,
  Target,
} from "lucide-react";
import { useProfilerStore } from "@/lib/store";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const recents = useProfilerStore((s) => s.recentResults);
  const saved = useProfilerStore((s) => s.savedAudiences);

  const featured = PEOPLE.slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto">
      <section className="rounded-2xl border bg-gradient-to-br from-primary/[0.08] via-surface to-surface p-8 mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Profiler · audience intelligence
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            Present work to the people who decide.
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Open a profile to see how a person prefers work framed, reviewed,
            and communicated. Drop in an artifact and get sharp, specific
            recommendations on how to land it with them.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href="/analyze">
              <Button size="lg">
                <FileSearch className="w-4 h-4" />
                Analyze an artifact
              </Button>
            </Link>
            <Link href="/audience">
              <Button variant="secondary" size="lg">
                <UsersRound className="w-4 h-4" />
                Build audience strategy
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Featured profiles</h2>
            </div>
            <Link
              href="/people"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              All people <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ul className="space-y-1">
            {featured.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/people/${p.id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-accent/60"
                >
                  <Avatar name={p.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium leading-tight">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.title} · {p.team}
                    </div>
                  </div>
                  <div className="hidden md:block text-sm text-muted-foreground truncate max-w-md">
                    {p.summary}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Objectives</h2>
          </div>
          <ul className="space-y-1.5">
            {OBJECTIVES.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link
                  href="/objectives"
                  className="block p-2 -mx-2 rounded-md hover:bg-accent/60"
                >
                  <div className="text-sm font-medium">{o.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {o.description}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/objectives"
            className="text-xs text-primary hover:underline mt-3 inline-flex items-center gap-1"
          >
            All {OBJECTIVES.length} objectives <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Recent analyses</h2>
            </div>
          </div>
          {!hydrated || recents.length === 0 ? (
            <EmptyState
              hydrated={hydrated}
              title="No analyses yet"
              body="Run your first artifact analysis to see it here."
              cta={{ href: "/analyze", label: "Analyze an artifact" }}
            />
          ) : (
            <ul className="space-y-1">
              {recents.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/results/${r.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-accent/60"
                  >
                    <div
                      className="w-8 h-8 rounded-md font-semibold text-xs inline-flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor:
                          r.fitScore >= 70
                            ? "rgb(22 163 74 / 0.1)"
                            : r.fitScore >= 45
                              ? "rgb(217 119 6 / 0.1)"
                              : "rgb(220 38 38 / 0.1)",
                        color:
                          r.fitScore >= 70
                            ? "#16a34a"
                            : r.fitScore >= 45
                              ? "#d97706"
                              : "#dc2626",
                      }}
                    >
                      {r.fitScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight truncate">
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
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
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UsersRound className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Saved audiences</h2>
            </div>
          </div>
          {!hydrated || saved.length === 0 ? (
            <EmptyState
              hydrated={hydrated}
              title="No saved audiences"
              body="Build an audience and save it for repeat use."
              cta={{ href: "/audience", label: "Build an audience" }}
            />
          ) : (
            <ul className="space-y-1">
              {saved.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href="/audience"
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-accent/60"
                  >
                    <div className="flex -space-x-2">
                      {a.personIds
                        .slice(0, 3)
                        .map((id) => {
                          const p = PEOPLE.find((p) => p.id === id);
                          return p ? (
                            <div
                              key={id}
                              className="ring-2 ring-background rounded-full"
                            >
                              <Avatar name={p.name} size={26} />
                            </div>
                          ) : null;
                        })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight truncate">
                        {a.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.personIds.length} people · {a.objectiveIds.length}{" "}
                        objectives
                      </div>
                    </div>
                    <Badge tone="subtle">Load</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  hydrated,
  title,
  body,
  cta,
}: {
  hydrated: boolean;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  if (!hydrated) return <div className="skeleton h-20" />;
  return (
    <div className="text-center py-6">
      <div className="text-sm font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
        {body}
      </p>
      <Link
        href={cta.href}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
      >
        {cta.label} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
