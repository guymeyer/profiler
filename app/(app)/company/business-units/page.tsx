"use client";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { BusinessUnitsSection } from "@/components/company/business-units-section";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

export default function CompanyBusinessUnitsPage() {
  return (
    <CompanyDetailShell companyId={INTERNAL_COMPANY_ID} baseHref="/company">
      <BusinessUnitsSection
        companyId={INTERNAL_COMPANY_ID}
        addHref="/business-units/new"
      />
    </CompanyDetailShell>
  );
}
