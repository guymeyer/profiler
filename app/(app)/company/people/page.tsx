"use client";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { PeopleSection } from "@/components/company/people-section";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

export default function CompanyPeoplePage() {
  return (
    <CompanyDetailShell companyId={INTERNAL_COMPANY_ID} baseHref="/company">
      <PeopleSection
        companyId={INTERNAL_COMPANY_ID}
        addHref="/people/new"
      />
    </CompanyDetailShell>
  );
}
