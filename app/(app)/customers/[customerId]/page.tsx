"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { Backlinks } from "@/components/backlinks";
import { useProfilerStore } from "@/lib/store";
import { useCompany } from "@/lib/hooks/use-companies";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import {
  customerToMarkdown,
  markdownToCustomer,
} from "@/lib/customer-md";
import { researchCustomer } from "@/app/(app)/customers/actions";
import { CompanyDetailShell } from "@/components/company/company-detail-shell";
import { CustomerIntelPanel } from "@/components/company/customer-intel-panel";
import type { Customer, CustomerCompany } from "@/lib/types";

interface Props {
  params: Promise<{ customerId: string }>;
}

// Customer overview. Uses the shared CompanyDetailShell, so the People /
// OKRs / Business units sub-nav is identical to /company. The intel
// panel (buying triggers / red flags / etc.) renders here on the
// overview only — those fields are customer-kind specific.

export default function CustomerOverviewPage({ params }: Props) {
  const { customerId } = use(params);
  const router = useRouter();
  const company = useCompany(customerId);
  const customer: CustomerCompany | undefined =
    company?.kind === "customer" ? company : undefined;
  const saveCustomer = useProfilerStore((s) => s.saveCustomer);
  const deleteCustomer = useProfilerStore((s) => s.deleteCustomer);
  const setSelectedCustomerId = useProfilerStore(
    (s) => s.setSelectedCustomerId,
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (editing && customer) {
      setDraft(customerToMarkdown(legacyCustomerFromCompany(customer)));
      setWarnings([]);
    }
  }, [editing, customer]);

  if (!hydrated) return null;
  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Customer not found</h1>
        <Link href="/customers" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Customers
        </Link>
      </div>
    );
  }

  function handleSave() {
    if (!customer) return;
    const legacy = legacyCustomerFromCompany(customer);
    const { customer: parsed, warnings: parseWarnings } = markdownToCustomer(
      draft,
      { existingId: customer.id, existing: legacy },
    );
    saveCustomer(parsed);
    setWarnings(parseWarnings);
    setEditing(false);
  }

  function handleDelete() {
    if (!customer) return;
    if (!confirm(`Delete ${customer.name}?`)) return;
    deleteCustomer(customer.id);
    router.push("/customers");
  }

  async function handleReresearch() {
    if (!customer) return;
    setResearchError(null);
    setResearching(true);
    try {
      const result = await researchCustomer({
        companyName: customer.name,
        context: customer.summary || undefined,
      });
      saveCustomer({
        ...result,
        id: customer.id,
        createdAt: customer.createdAt,
        tags: Array.from(new Set([...customer.tags, ...result.tags])),
      });
    } catch (e) {
      setResearchError((e as Error).message);
    } finally {
      setResearching(false);
    }
  }

  function handleUseInAudience() {
    if (!customer) return;
    setSelectedCustomerId(customer.id);
    router.push("/audience");
  }

  return (
    <CompanyDetailShell
      companyId={customer.id}
      baseHref={`/customers/${customer.id}`}
      backHref="/customers"
      backLabel="Customers"
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={handleUseInAudience}>
          Use in audience
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReresearch}
          disabled={researching}
        >
          {researching ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Researching…
            </>
          ) : (
            "Re-research"
          )}
        </Button>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {researchError && (
        <Card className="p-4 mb-4 border-danger/30 bg-danger/[0.05]">
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{researchError}</span>
          </div>
        </Card>
      )}

      {editing ? (
        <Card className="p-5">
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            warnings={warnings}
            saveLabel="Save customer"
          />
        </Card>
      ) : (
        <>
          <CustomerIntelPanel customer={customer} />
          <Section title="References" divider>
            <Backlinks entity={{ kind: "customer", id: customer.id }} />
          </Section>
        </>
      )}
    </CompanyDetailShell>
  );
}

// Adapter for the legacy customer-md round-trip. Phased out in PR 20.
function legacyCustomerFromCompany(c: CustomerCompany): Customer {
  return {
    id: c.id,
    name: c.name,
    industry: c.industry,
    size: c.size,
    region: c.region,
    summary: c.summary,
    knownStakeholders: c.properties.knownStakeholders,
    buyingTriggers: c.properties.buyingTriggers,
    evaluationCriteria: c.properties.evaluationCriteria,
    redFlags: c.properties.redFlags,
    competitiveContext: c.properties.competitiveContext,
    notes: c.properties.notes,
    tags: c.tags,
    source: c.properties.source,
    researchedAt: c.properties.researchedAt,
    createdAt: c.createdAt,
  };
}
