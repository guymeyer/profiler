"use client";
import { use } from "react";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { BusinessUnitsSection } from "@/components/company/business-units-section";

interface Props {
  params: Promise<{ customerId: string }>;
}

export default function CustomerBusinessUnitsPage({ params }: Props) {
  const { customerId } = use(params);
  return (
    <CompanyDetailShell
      companyId={customerId}
      baseHref={`/customers/${customerId}`}
      backHref="/customers"
      backLabel="Customers"
    >
      <BusinessUnitsSection
        companyId={customerId}
        addHref={`/business-units/new?companyId=${customerId}`}
      />
    </CompanyDetailShell>
  );
}
