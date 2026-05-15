"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Flag, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { OKRForm } from "@/components/okrs/okr-form";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import type { OKRStatus } from "@/lib/types";

const STATUS_TONE: Record<OKRStatus, "success" | "warning" | "danger" | "subtle"> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "danger",
  achieved: "subtle",
};

interface Props {
  params: Promise<{ okrId: string }>;
}

export default function OKRDetailPage({ params }: Props) {
  const { okrId } = use(params);
  const router = useRouter();
  const okr = useProfilerStore((s) => s.okrs?.[okrId]);
  const saveOKR = useProfilerStore((s) => s.saveOKR);
  const deleteOKR = useProfilerStore((s) => s.deleteOKR);
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const people = useEffectivePeople();
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;
  if (!okr) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">OKR not found</h1>
        <div className="mt-6">
          <Link href="/okrs">
            <Button>Back to OKRs</Button>
          </Link>
        </div>
      </div>
    );
  }

  const bu = okr.businessUnitId ? bus[okr.businessUnitId] : undefined;
  const owners = people.filter((p) => okr.ownerPersonIds.includes(p.id));
  const attached = people.filter((p) =>
    okr.attachedPersonIds.includes(p.id),
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/okrs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All OKRs
      </Link>

      {editing ? (
        <>
          <header className="mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">Edit OKR</h1>
          </header>
          <OKRForm
            initial={okr}
            people={people}
            bus={Object.values(bus)}
            saveLabel="Save changes"
            onSubmit={(o) => {
              saveOKR(o);
              setEditing(false);
            }}
            onDelete={() => {
              deleteOKR(okr.id);
              router.push("/okrs");
            }}
          />
        </>
      ) : (
        <>
          <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                <Flag className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight leading-tight">
                  {okr.objective}
                </h1>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Badge tone={okr.level === "company" ? "primary" : "neutral"}>
                    {okr.level === "company" ? "Company" : "BU"}
                  </Badge>
                  {bu && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {bu.name}
                    </span>
                  )}
                  <span>· {okr.timeframe}</span>
                  {okr.status && (
                    <Badge tone={STATUS_TONE[okr.status]} className="text-[10px]">
                      {okr.status.replace("-", " ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </header>

          <Card className="p-5 mb-4">
            <h3 className="font-semibold mb-3">Key Results</h3>
            <ol className="space-y-2.5">
              {okr.keyResults.map((kr, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-medium text-[11px] inline-flex items-center justify-center shrink-0">
                    KR{i + 1}
                  </span>
                  <p className="leading-relaxed pt-0.5">{kr}</p>
                </li>
              ))}
            </ol>
          </Card>

          {okr.notes && (
            <Card className="p-5 mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                Notes
              </div>
              <p className="leading-relaxed">{okr.notes}</p>
            </Card>
          )}

          {(owners.length > 0 || attached.length > 0) && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3">People</h3>
              {owners.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Owners
                  </div>
                  <PeopleList people={owners} />
                </div>
              )}
              {attached.filter((p) => !okr.ownerPersonIds.includes(p.id))
                .length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Attached
                  </div>
                  <PeopleList
                    people={attached.filter(
                      (p) => !okr.ownerPersonIds.includes(p.id),
                    )}
                  />
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PeopleList({ people }: { people: { id: string; name: string; title: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => (
        <Link key={p.id} href={`/people/${p.id}`}>
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border hover:bg-accent/40 transition-colors">
            <Avatar name={p.name} size={24} />
            <div>
              <div className="text-sm font-medium leading-tight">{p.name}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">
                {p.title}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
