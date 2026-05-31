"use client";
import Link from "next/link";
import { useProfilerStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { usePeopleByCompany } from "@/lib/people-hooks";
import { useInternalCompany } from "@/lib/hooks/use-companies";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

// Internal Company overview. Counts at a glance + quick links into the
// subpages. Same content shape will be reused for /customers/[id]/page.

export default function CompanyOverviewPage() {
  const company = useInternalCompany();
  const peopleCount = usePeopleByCompany(INTERNAL_COMPANY_ID).length;
  const { okrCount, buCount, documentCount } = useProfilerStore(
    useShallow((s) => {
      let o = 0;
      for (const okr of Object.values(s.okrs ?? {})) {
        if ((okr.companyId ?? INTERNAL_COMPANY_ID) === INTERNAL_COMPANY_ID) o++;
      }
      let b = 0;
      for (const bu of Object.values(s.businessUnits ?? {})) {
        if ((bu.companyId ?? INTERNAL_COMPANY_ID) === INTERNAL_COMPANY_ID) b++;
      }
      const d = Object.keys(s.documents ?? {}).length;
      return { okrCount: o, buCount: b, documentCount: d };
    }),
  );

  return (
    <CompanyDetailShell companyId={INTERNAL_COMPANY_ID} baseHref="/company">
      {company?.summary && (
        <p className="text-[14px] text-muted-foreground mb-6 leading-relaxed">
          {company.summary}
        </p>
      )}

      <Section title="At a glance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatLink href="/company/people" label="People" value={peopleCount} />
          <StatLink href="/company/okrs" label="OKRs" value={okrCount} />
          <StatLink
            href="/company/business-units"
            label="Business units"
            value={buCount}
          />
          <StatLink
            href="/knowledge"
            label="Documents"
            value={documentCount}
          />
        </div>
      </Section>
    </CompanyDetailShell>
  );
}

function StatLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:bg-accent/40 transition-colors">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
          {label}
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </Card>
    </Link>
  );
}
