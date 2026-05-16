"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  BookOpen,
  Calendar,
  Users,
  Building2,
  Target,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResearchForm } from "@/components/research/research-form";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";

interface Props {
  params: Promise<{ researchId: string }>;
}

export default function ResearchDetailPage({ params }: Props) {
  const { researchId } = use(params);
  const router = useRouter();
  const research = useProfilerStore((s) => s.research?.[researchId]);
  const saveResearch = useProfilerStore((s) => s.saveResearch);
  const deleteResearch = useProfilerStore((s) => s.deleteResearch);
  const customers = useProfilerStore((s) => s.customers ?? {});
  const people = useEffectivePeople();

  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;
  if (!research) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Research not found</h1>
        <div className="mt-6">
          <Link href="/research">
            <Button>Back to research</Button>
          </Link>
        </div>
      </div>
    );
  }

  const linkedPeople = people.filter((p) =>
    research.linkedPersonIds.includes(p.id),
  );
  const linkedCustomers = Object.values(customers).filter((c) =>
    research.linkedCustomerIds.includes(c.id),
  );
  const linkedObjectives = OBJECTIVES.filter((o) =>
    research.linkedObjectiveIds.includes(o.id),
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/research"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All research
      </Link>

      {editing ? (
        <>
          <header className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Edit research
            </h1>
          </header>
          <ResearchForm
            initial={research}
            people={people}
            customers={Object.values(customers)}
            objectives={OBJECTIVES}
            saveLabel="Save changes"
            onSubmit={(next) => {
              saveResearch(next);
              setEditing(false);
            }}
            onDelete={() => {
              deleteResearch(research.id);
              router.push("/research");
            }}
          />
        </>
      ) : (
        <>
          <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {research.title}
                </h1>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span>{research.source}</span>
                  {research.conductedAt && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(research.conductedAt).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "long", day: "numeric" },
                        )}
                      </span>
                    </>
                  )}
                </div>
                {research.uploadedFrom && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Uploaded from {research.uploadedFrom.filename}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </header>

          {research.summary && (
            <Card className="p-6 mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                Executive summary
              </div>
              <p className="text-lg leading-relaxed">{research.summary}</p>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Body</h3>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90 max-h-[600px] overflow-auto">
                {research.content}
              </pre>
            </Card>

            <aside className="space-y-3">
              {research.methodology && (
                <Card className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                    Methodology
                  </div>
                  <p className="text-sm">{research.methodology}</p>
                </Card>
              )}
              {research.participants.length > 0 && (
                <Card className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Participants
                  </div>
                  <ul className="space-y-1 text-sm">
                    {research.participants.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </Card>
              )}
              {(linkedPeople.length > 0 ||
                linkedCustomers.length > 0 ||
                linkedObjectives.length > 0) && (
                <Card className="p-4 space-y-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Linked to
                  </div>
                  {linkedPeople.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        People
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {linkedPeople.map((p) => (
                          <Link key={p.id} href={`/people/${p.id}`}>
                            <Badge tone="neutral" className="text-[10px] hover:opacity-80">
                              {p.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {linkedCustomers.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Customers
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {linkedCustomers.map((c) => (
                          <Link key={c.id} href={`/customers/${c.id}`}>
                            <Badge tone="neutral" className="text-[10px] hover:opacity-80">
                              {c.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {linkedObjectives.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Objectives
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {linkedObjectives.map((o) => (
                          <Badge key={o.id} tone="neutral" className="text-[10px]">
                            {o.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
              {research.tags.length > 0 && (
                <Card className="p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {research.tags.map((t) => (
                      <Badge key={t} tone="subtle" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
