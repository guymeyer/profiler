"use client";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { OKRsSection } from "@/components/company/okrs-section";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

export default function CompanyOKRsPage() {
  return (
    <CompanyDetailShell companyId={INTERNAL_COMPANY_ID} baseHref="/company">
      <OKRsSection companyId={INTERNAL_COMPANY_ID} addHref="/okrs/new" />
    </CompanyDetailShell>
  );
}
