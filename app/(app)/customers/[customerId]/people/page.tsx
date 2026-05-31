"use client";
import { use } from "react";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { PeopleSection } from "@/components/company/people-section";

interface Props {
  params: Promise<{ customerId: string }>;
}

export default function CustomerPeoplePage({ params }: Props) {
  const { customerId } = use(params);
  return (
    <CompanyDetailShell
      companyId={customerId}
      baseHref={`/customers/${customerId}`}
      backHref="/customers"
      backLabel="Customers"
    >
      <PeopleSection
        companyId={customerId}
        addHref={`/customers/${customerId}/employees/new`}
      />
    </CompanyDetailShell>
  );
}
