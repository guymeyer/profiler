"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  InlineDatabase,
  DbDate,
  type InlineDatabaseColumn,
} from "@/components/ui/inline-database";
import { useCustomerCompaniesList } from "@/lib/hooks/use-companies";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const list = useCustomerCompaniesList();
  const hydrated = useHydrated();

  const columns: InlineDatabaseColumn<Customer>[] = [
    {
      key: "name",
      label: "Name",
      render: (c) => <span className="font-medium">{c.name}</span>,
      sortValue: (c) => c.name,
    },
    {
      key: "industry",
      label: "Industry",
      kind: "muted",
      render: (c) => c.industry ?? "",
      sortValue: (c) => c.industry ?? "",
    },
    {
      key: "size",
      label: "Size",
      kind: "muted",
      width: "w-[120px]",
      render: (c) => c.size ?? "",
    },
    {
      key: "region",
      label: "Region",
      kind: "muted",
      width: "w-[120px]",
      render: (c) => c.region ?? "",
    },
    {
      key: "source",
      label: "Source",
      kind: "muted",
      width: "w-[100px]",
      render: (c) => (c.source === "research" ? "Researched" : "Manual"),
    },
    {
      key: "added",
      label: "Added",
      kind: "date",
      width: "w-[140px]",
      render: (c) => <DbDate iso={c.createdAt} />,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        meta={
          <>
            {list.length} {list.length === 1 ? "customer" : "customers"} on
            file. Add a company manually or trigger deep research to draft a
            profile from public sources.
          </>
        }
        actions={
          <>
            <Link href="/customers/new?research=1">
              <Button variant="secondary">Research a company</Button>
            </Link>
            <Link href="/customers/new">
              <Button>Add customer</Button>
            </Link>
          </>
        }
      />

      {!hydrated ? null : list.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-10 text-center">
          <h2 className="font-semibold mb-1">No customers yet</h2>
          <p className="text-[13px] text-muted-foreground mb-4 max-w-md mx-auto">
            Add a company manually if you already know who you&apos;re
            pitching, or kick off a deep-research draft from a name.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link href="/customers/new">
              <Button>Add customer</Button>
            </Link>
            <Link href="/customers/new?research=1">
              <Button variant="secondary">Research a company</Button>
            </Link>
          </div>
        </div>
      ) : (
        <InlineDatabase
          rows={list}
          columns={columns}
          rowHref={(c) => `/customers/${c.id}`}
        />
      )}

    </div>
  );
}
