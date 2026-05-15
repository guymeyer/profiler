"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  X,
  Sparkles,
  MessageSquare,
  Eye,
  Zap,
  ShieldAlert,
  FileSearch,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddToAudience } from "@/components/audience/add-to-audience";
import { RecentForPerson } from "@/components/people/recent-for-person";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useEffectivePerson } from "@/lib/people-hooks";
import { useProfilerStore } from "@/lib/store";
import {
  markdownToPerson,
  personToMarkdown,
} from "@/lib/profile-md";
import { PEOPLE } from "@/lib/data/people";

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

  // Sync draft when entering edit mode or person changes
  useEffect(() => {
    if (editing && person) {
      setDraft(personToMarkdown(person));
      setWarnings([]);
    }
  }, [editing, person]);

  if (!hydrated || !person) {
    if (hydrated && !person) {
      return (
        <div className="max-w-3xl mx-auto py-16 text-center">
          <h1 className="text-xl font-semibold">Profile not found</h1>
          <p className="text-muted-foreground mt-2">
            This person doesn't exist in the seed library or your custom
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
    return null;
  }

  const isSeed = PEOPLE.some((p) => p.id === personId);
  const isOverridden = isSeed && !!customProfiles[personId];
  const isCustom = !isSeed;

  function handleSave() {
    const { person: parsed, warnings: parseWarnings } = markdownToPerson(draft, {
      existingId: person!.id,
    });
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

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/people"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All people
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Left rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-5">
          <div className="flex items-start gap-4">
            <Avatar name={person.name} size={64} />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight leading-tight">
                {person.name}
              </h1>
              <div className="text-sm text-muted-foreground">
                {person.title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {person.team}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {person.customerId && (
                  <CustomerBadge customerId={person.customerId} />
                )}
                {(isOverridden || isCustom) && !person.customerId && (
                  <Badge tone="primary">
                    {isCustom ? "Custom" : "Edited"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Influence
            </div>
            <Badge tone="primary">{INFLUENCE_LABELS[person.influence]}</Badge>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Communication style
            </div>
            <div className="flex flex-wrap gap-1.5">
              {person.commStyle.map((c) => (
                <Badge key={c} tone="neutral">
                  {COMM_LABELS[c] ?? c}
                </Badge>
              ))}
            </div>
          </div>

          {person.tags.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {person.tags.map((t) => (
                  <Badge key={t} tone="subtle">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Link href={`/analyze?personIds=${person.id}`} className="block">
              <Button className="w-full">
                <FileSearch className="w-3.5 h-3.5" />
                Analyze artifact for {person.name.split(" ")[0]}
              </Button>
            </Link>
            <AddToAudience personId={person.id} />
          </div>

          <div className="space-y-2 pt-2 border-t">
            {!editing && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit profile
              </Button>
            )}
            {isOverridden && !editing && (
              <Button
                variant="secondary"
                className="w-full text-muted-foreground"
                onClick={handleRevert}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Revert to seed
              </Button>
            )}
          </div>

          <RecentForPerson personId={person.id} />
        </aside>

        {/* Right content */}
        <div className="space-y-6 min-w-0">
          {editing ? (
            <Card className="p-5">
              <div className="mb-3">
                <h2 className="font-semibold tracking-tight">Edit profile</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Profile is markdown. Top-of-file bullets set typed fields
                  (influence, communication style, tags). Each <code>##</code>{" "}
                  heading is a section.
                </p>
              </div>
              <MarkdownEditor
                value={draft}
                onChange={setDraft}
                onSave={handleSave}
                onCancel={() => setEditing(false)}
                onDelete={isCustom ? handleDelete : undefined}
                warnings={warnings}
                saveLabel={isCustom ? "Save custom profile" : "Save override"}
              />
            </Card>
          ) : (
            <ReadView person={person} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReadView({ person }: { person: import("@/lib/types").Person }) {
  return (
    <>
      <Card className="p-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
          Overview
        </div>
        <p className="text-lg leading-relaxed">{person.summary}</p>
      </Card>

      <ProfileSection
        icon={MessageSquare}
        title="Communication preferences"
        items={person.reviewPreferences}
      />
      <ProfileSection
        icon={Eye}
        title="Presentation preferences"
        items={person.visualPreferences}
      />
      <ProfileSection
        icon={Zap}
        title="Decision triggers"
        items={person.decisionTriggers}
      />
      <ProfileSection
        icon={ShieldAlert}
        title="Predictable objections"
        items={person.objections}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-success/10 text-success inline-flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-semibold">Do</h3>
          </div>
          <ul className="space-y-2">
            {person.dos.map((d, i) => (
              <li
                key={i}
                className="text-sm leading-relaxed text-foreground/90"
              >
                {d}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-danger/10 text-danger inline-flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-semibold">Don't</h3>
          </div>
          <ul className="space-y-2">
            {person.donts.map((d, i) => (
              <li
                key={i}
                className="text-sm leading-relaxed text-foreground/90"
              >
                {d}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Example guidance</h3>
        </div>
        <ol className="space-y-4">
          {person.exampleGuidance.map((g, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-xs font-mono text-muted-foreground mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-relaxed text-foreground/90">{g}</p>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function CustomerBadge({ customerId }: { customerId: string }) {
  const customer = useProfilerStore((s) => s.customers?.[customerId]);
  if (!customer) {
    return <Badge tone="subtle">Employee · unknown customer</Badge>;
  }
  return (
    <Link href={`/customers/${customer.id}`}>
      <Badge tone="primary" className="hover:opacity-80">
        Employee at {customer.name}
      </Badge>
    </Link>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed text-foreground/90 flex gap-2.5"
          >
            <span className="text-muted-foreground mt-1.5 shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

