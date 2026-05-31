"use client";
import {
  AlertTriangle,
  Compass,
  Flag,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import type { CustomerCompany } from "@/lib/types";

// Customer-specific intel surfaces (buying triggers, red flags, etc.).
// Renders nothing on internal Companies — used only inside
// /customers/[id]/* via the shared CompanyDetailShell.

interface Props {
  customer: CustomerCompany;
}

export function CustomerIntelPanel({ customer }: Props) {
  const p = customer.properties;
  return (
    <div>
      {customer.summary && (
        <Section title="Summary">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            {customer.summary}
          </p>
        </Section>
      )}

      <IntelList
        icon={Users}
        title="Known stakeholders"
        items={p.knownStakeholders}
      />
      <IntelList icon={Flag} title="Buying triggers" items={p.buyingTriggers} />
      <IntelList
        icon={Compass}
        title="Evaluation criteria"
        items={p.evaluationCriteria}
      />
      <IntelList icon={ShieldAlert} title="Red flags" items={p.redFlags} />
      <IntelList
        icon={AlertTriangle}
        title="Competitive context"
        items={p.competitiveContext}
      />
      <IntelList icon={Sparkles} title="Notes" items={p.notes} />

      {customer.tags.length > 0 && (
        <Section title="Tags" divider>
          <div className="flex flex-wrap gap-1">
            {customer.tags.map((t) => (
              <Badge key={t} tone="subtle">
                {t}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function IntelList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Users;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <Section
      title={
        <span className="inline-flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          {title}
        </span>
      }
      divider
    >
      <ul className="space-y-1.5 text-[14px] text-foreground/90 leading-relaxed list-disc pl-5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </Section>
  );
}
