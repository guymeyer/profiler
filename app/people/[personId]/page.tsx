import Link from "next/link";
import { notFound } from "next/navigation";
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
} from "lucide-react";
import { PEOPLE, getPerson } from "@/lib/data/people";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AddToAudience } from "@/components/audience/add-to-audience";

export function generateStaticParams() {
  return PEOPLE.map((p) => ({ personId: p.id }));
}

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

export default async function PersonPage({ params }: Props) {
  const { personId } = await params;
  const person = getPerson(personId);
  if (!person) notFound();

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

          <div className="space-y-2 pt-2">
            <Link href={`/analyze?personIds=${person.id}`} className="block">
              <Button className="w-full">
                <FileSearch className="w-3.5 h-3.5" />
                Analyze artifact for {person.name.split(" ")[0]}
              </Button>
            </Link>
            <AddToAudience personId={person.id} />
          </div>
        </aside>

        {/* Right content */}
        <div className="space-y-6 min-w-0">
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
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {g}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
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
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-foreground/90 flex gap-2.5">
            <span className="text-muted-foreground mt-1.5 shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
