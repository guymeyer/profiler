"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { AddToAudience } from "@/components/audience/add-to-audience";
import { RecentForPerson } from "@/components/people/recent-for-person";
import { AutoBrief } from "@/components/auto-brief";
import { Backlinks } from "@/components/backlinks";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useEffectivePerson } from "@/lib/people-hooks";
import { useProfilerStore } from "@/lib/store";
import {
  useCompany,
  useCustomerCompanies,
} from "@/lib/hooks/use-companies";
import {
  markdownToPerson,
  personToMarkdown,
} from "@/lib/profile-md";
import { PEOPLE } from "@/lib/data/people";
import type { Person } from "@/lib/types";

interface Props {
  params: Promise<{ personId: string }>;
}

const COMM_LABELS: Record<string, string> = {
  "data-driven": "Data-driven",
  narrative: "Narrative",
  visual: "Visual",
  operational: "Operational",
  "customer-centric": "Customer-centric",
  consensus: "Consensus",
  technical: "Technical",
};

const INFLUENCE_LABELS: Record<string, string> = {
  executive: "Executive",
  senior: "Senior",
  lead: "Lead",
  ic: "IC",
};

export default function PersonPage({ params }: Props) {
  const { personId } = use(params);
  const router = useRouter();
  const person = useEffectivePerson(personId);
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const deleteProfile = useProfilerStore((s) => s.deleteProfile);
  const customProfiles = useProfilerStore((s) => s.customProfiles ?? {});

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (editing && person) {
      setDraft(personToMarkdown(person));
      setWarnings([]);
    }
  }, [editing, person]);

  if (!hydrated) return null;
  if (!person) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="text-muted-foreground mt-2 text-[13px]">
          This person doesn&apos;t exist in the seed library or your custom
          profiles.
        </p>
        <div className="mt-6">
          <Link href="/people">
            <Button>Back to people</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isSeed = PEOPLE.some((p) => p.id === personId);
  const isOverridden = isSeed && !!customProfiles[personId];
  const isCustom = !isSeed;

  function handleSave() {
    const { person: parsed, warnings: parseWarnings } = markdownToPerson(
      draft,
      { existingId: person!.id },
    );
    setWarnings(parseWarnings);
    saveProfile(parsed);
    setEditing(false);
  }

  function handleRevert() {
    if (!isSeed) return;
    deleteProfile(personId);
    setEditing(false);
  }

  function handleDelete() {
    if (!isCustom) return;
    deleteProfile(personId);
    router.push("/people");
  }

  if (editing) {
    return (
      <div>
        <BackLink />
        <PageHeader eyebrow="Person" title="Edit profile" />
        <p className="text-[13px] text-muted-foreground mb-4">
          Profile is markdown. Top-of-file bullets set typed fields (influence,
          communication style, tags). Each <code className="text-foreground">##</code>{" "}
          heading is a section.
        </p>
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          onDelete={isCustom ? handleDelete : undefined}
          warnings={warnings}
          saveLabel={isCustom ? "Save custom profile" : "Save override"}
        />
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <PageHeader
        eyebrow="Person"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={person.name} size={36} />
            {person.name}
          </span>
        }
        meta={
          <>
            {person.title} · {person.team} ·{" "}
            <span className="text-foreground/80">
              {INFLUENCE_LABELS[person.influence]}
            </span>
            {person.customerId && (
              <>
                {" · "}
                <CustomerLink customerId={person.customerId} />
              </>
            )}
            {(isOverridden || isCustom) && !person.customerId && (
              <>
                {" · "}
                <span className="text-foreground/80">
                  {isCustom ? "Custom" : "Edited"}
                </span>
              </>
            )}
          </>
        }
        actions={
          <>
            <Link href={`/analyze?personIds=${person.id}`}>
              <Button variant="secondary">Analyze for {person.name.split(" ")[0]}</Button>
            </Link>
            <AddToAudience personId={person.id} />
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {isOverridden && (
              <Button variant="ghost" onClick={handleRevert}>
                <RotateCcw className="w-3 h-3" />
                Revert
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground items-center">
          <span>Style:</span>
          {person.commStyle.map((c) => (
            <span key={c} className="text-foreground/80">
              {COMM_LABELS[c] ?? c}
            </span>
          ))}
          {person.tags.length > 0 && (
            <>
              <span className="mx-1">·</span>
              <span>Tags:</span>
              {person.tags.map((t) => (
                <Badge key={t} tone="subtle">
                  {t}
                </Badge>
              ))}
            </>
          )}
        </div>
      </PageHeader>

      <Section title="Summary">
        <p className="text-[15px] leading-relaxed text-foreground/90">
          {person.summary}
        </p>
      </Section>

      <SimpleListSection
        title="Communication preferences"
        items={person.reviewPreferences}
      />
      <SimpleListSection
        title="Presentation preferences"
        items={person.visualPreferences}
      />
      <SimpleListSection
        title="Decision triggers"
        items={person.decisionTriggers}
      />
      <SimpleListSection
        title="Predictable objections"
        items={person.objections}
      />

      {person.dos.length > 0 && (
        <Section title="Do" divider>
          <ul className="text-[14px] text-foreground/90 leading-relaxed space-y-1.5 list-disc pl-5">
            {person.dos.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      )}

      {person.donts.length > 0 && (
        <Section title={"Don’t"} divider>
          <ul className="text-[14px] text-foreground/90 leading-relaxed space-y-1.5 list-disc pl-5">
            {person.donts.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
      )}

      <ExpertiseSection person={person} />

      {person.exampleGuidance.length > 0 && (
        <Section title="Example guidance" divider>
          <ol className="space-y-3 text-[14px] leading-relaxed">
            {person.exampleGuidance.map((g, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0 pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground/90">{g}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="References" divider>
        <Backlinks entity={{ kind: "person", id: person.id }} />
      </Section>

      <Section title="Recent analyses" divider>
        <RecentForPerson personId={person.id} />
      </Section>

      <Section title="Brief" divider>
        <PersonAutoBrief person={person} />
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/people"
      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
    >
      <ArrowLeft className="w-3 h-3" />
      People
    </Link>
  );
}

function SimpleListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <Section title={title} divider>
      <ul className="text-[14px] text-foreground/90 leading-relaxed space-y-1.5 list-disc pl-5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </Section>
  );
}

function CustomerLink({ customerId }: { customerId: string }) {
  const customer = useCompany(customerId);
  if (!customer || customer.kind !== "customer") {
    return <span className="text-muted-foreground">Customer employee</span>;
  }
  return (
    <Link href={`/customers/${customer.id}`} className="link">
      {customer.name} employee
    </Link>
  );
}

function ExpertiseSection({ person }: { person: Person }) {
  const expertise = mergeUserAuto(
    person.expertiseAreas,
    person.expertiseAreasAuto,
  );
  const active = mergeUserAuto(person.activeWork, person.activeWorkAuto);
  const interests = mergeUserAuto(person.interests, person.interestsAuto);
  if (
    expertise.entries.length === 0 &&
    active.entries.length === 0 &&
    interests.entries.length === 0
  ) {
    return null;
  }
  return (
    <Section
      title="Expertise"
      subtitle="drives recommendations across the app"
      divider
    >
      <div className="space-y-4">
        <ExpertiseRow label="Areas" entries={expertise.entries} />
        <ExpertiseRow label="Active work" entries={active.entries} />
        <ExpertiseRow label="Interests" entries={interests.entries} />
      </div>
    </Section>
  );
}

function mergeUserAuto(
  user?: string[],
  auto?: string[],
): { entries: { value: string; auto: boolean }[] } {
  const userSet = new Set((user ?? []).map((s) => s.toLowerCase()));
  const entries: { value: string; auto: boolean }[] = [
    ...(user ?? []).map((v) => ({ value: v, auto: false })),
    ...(auto ?? [])
      .filter((v) => !userSet.has(v.toLowerCase()))
      .map((v) => ({ value: v, auto: true })),
  ];
  return { entries };
}

function ExpertiseRow({
  label,
  entries,
}: {
  label: string;
  entries: { value: string; auto: boolean }[];
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e, i) => (
          <Badge
            key={i}
            tone="subtle"
            className="inline-flex items-center gap-1"
            title={
              e.auto
                ? "Suggested by AI from linked artifacts"
                : "Set on profile"
            }
          >
            {e.value}
            {e.auto && (
              <span className="text-[9px] uppercase tracking-wider opacity-70">
                ai
              </span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function PersonAutoBrief({ person }: { person: Person }) {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const customers = useCustomerCompanies();

  const blocks = (() => {
    const out: { label: string; body: string }[] = [];
    for (const d of Object.values(documents)) {
      if (!d.linkedPersonIds.includes(person.id)) continue;
      if (d.kind === "research") {
        out.push({
          label: `Research: ${d.title}`,
          body: `${d.summary}\n\n${d.content.slice(0, 1500)}`,
        });
      } else if (d.kind === "prd") {
        out.push({
          label: `PRD: ${d.title}`,
          body: `Status: ${d.properties.status}\nProblem: ${d.properties.problem}\nSolution: ${d.properties.solution}\n${d.summary}`,
        });
      } else if (d.kind === "memo") {
        out.push({
          label: `Memo: ${d.title}`,
          body: `${d.summary}\n${(d.properties.keyClaims ?? []).slice(0, 3).join("; ")}`,
        });
      }
    }
    if (person.customerId) {
      const c = customers[person.customerId];
      if (c) {
        out.push({ label: `Customer: ${c.name}`, body: c.summary ?? "" });
      }
    }
    out.push({
      label: "Profile: stated preferences",
      body: `Summary: ${person.summary}\nDecision triggers: ${person.decisionTriggers.join("; ")}\nObjections: ${person.objections.join("; ")}`,
    });
    return out;
  })();

  return (
    <AutoBrief
      subject={{
        kind: "person",
        name: person.name,
        description: `${person.title} · ${person.team}`,
      }}
      contextBlocks={blocks}
    />
  );
}
