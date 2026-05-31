"use client";
import { use } from "react";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { OKRsSection } from "@/components/company/okrs-section";

interface Props {
  params: Promise<{ customerId: string }>;
}

export default function CustomerOKRsPage({ params }: Props) {
  const { customerId } = use(params);
  return (
    <CompanyDetailShell
      companyId={customerId}
      baseHref={`/customers/${customerId}`}
      backHref="/customers"
      backLabel="Customers"
    >
      <OKRsSection
        companyId={customerId}
        addHref={`/okrs/new?companyId=${customerId}`}
      />
    </CompanyDetailShell>
  );
}
