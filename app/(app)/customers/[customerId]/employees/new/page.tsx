"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useProfilerStore } from "@/lib/store";
import {
  BLANK_PERSON_MARKDOWN,
  markdownToPerson,
  slugifyId,
} from "@/lib/profile-md";
import { slugifyId as slugifyCustomerId } from "@/lib/customer-md";
import { useCompany } from "@/lib/hooks/use-companies";
import { PEOPLE } from "@/lib/data/people";

interface Props {
  params: Promise<{ customerId: string }>;
}

export default function NewEmployeePage({ params }: Props) {
  const { customerId } = use(params);
  const router = useRouter();
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const customProfiles = useProfilerStore((s) => s.customProfiles ?? {});
  const customer = useCompany(customerId);
  const [draft, setDraft] = useState(
    BLANK_PERSON_MARKDOWN.replace(
      "- Tags:",
      `- Tags: customer:${customerId}\n- Customer: ${customerId}`,
    ),
  );
  const [warnings, setWarnings] = useState<string[]>([]);

  function handleSave() {
    const { person, warnings: parseWarnings } = markdownToPerson(draft);
    person.customerId = customerId;
    const taken = new Set([
      ...PEOPLE.map((p) => p.id),
      ...Object.keys(customProfiles),
    ]);
    const slugCustomer = slugifyCustomerId(customer?.name ?? customerId);
    let id = `${slugCustomer}-${slugifyId(person.name)}`;
    let n = 2;
    while (taken.has(id)) id = `${slugCustomer}-${slugifyId(person.name)}-${n++}`;
    const final = { ...person, id };
    saveProfile(final);
    setWarnings(parseWarnings);
    router.push(`/people/${id}`);
  }

  if (!customer) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Customer not found</h1>
        <p className="text-muted-foreground mt-2">
          The customer this employee belongs to doesn't exist yet.
        </p>
        <div className="mt-6">
          <Link href="/customers">
            <Button>Back to customers</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/customers/${customerId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {customer.name}
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          New employee — {customer.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Drafts a stakeholder profile attached to this customer. Will show up
          in the org chart by influence level.
        </p>
      </header>

      <Card className="p-5">
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSave}
          warnings={warnings}
          saveLabel="Create employee"
        />
      </Card>
    </div>
  );
}
