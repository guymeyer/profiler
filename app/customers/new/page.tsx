"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useProfilerStore } from "@/lib/store";
import {
  BLANK_CUSTOMER_MARKDOWN,
  customerToMarkdown,
  markdownToCustomer,
  slugifyId,
} from "@/lib/customer-md";
import { researchCustomer } from "@/app/customers/actions";

export default function NewCustomerPage() {
  return (
    <Suspense fallback={null}>
      <NewCustomerForm />
    </Suspense>
  );
}

function NewCustomerForm() {
  const router = useRouter();
  const params = useSearchParams();
  const startResearch = params.get("research") === "1";

  const saveCustomer = useProfilerStore((s) => s.saveCustomer);
  const customers = useProfilerStore((s) => s.customers ?? {});

  const [mode, setMode] = useState<"manual" | "research">(
    startResearch ? "research" : "manual",
  );
  const [draft, setDraft] = useState(BLANK_CUSTOMER_MARKDOWN);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [researchName, setResearchName] = useState("");
  const [researchContext, setResearchContext] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  function handleManualSave() {
    const { customer, warnings: parseWarnings } = markdownToCustomer(draft);
    const taken = new Set(Object.keys(customers));
    let id = slugifyId(customer.name);
    let n = 2;
    while (taken.has(id)) id = `${slugifyId(customer.name)}-${n++}`;
    const final = { ...customer, id };
    saveCustomer(final);
    setWarnings(parseWarnings);
    router.push(`/customers/${id}`);
  }

  async function handleResearch() {
    setResearchError(null);
    setResearching(true);
    try {
      const result = await researchCustomer({
        companyName: researchName.trim(),
        context: researchContext.trim() || undefined,
      });
      setDraft(customerToMarkdown(result));
      setMode("manual");
    } catch (e) {
      setResearchError((e as Error).message);
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All customers
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Add customer</h1>
        <p className="text-muted-foreground mt-1">
          Draft a customer profile manually, or kick off deep research from a
          company name.
        </p>
      </header>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setMode("manual")}
          className={`text-sm px-3 py-1.5 rounded-md border ${mode === "manual" ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode("research")}
          className={`text-sm px-3 py-1.5 rounded-md border ${mode === "research" ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Sparkles className="w-3.5 h-3.5 inline mr-1" />
          Deep research
        </button>
      </div>

      {mode === "research" ? (
        <Card className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Company name
            </label>
            <Input
              value={researchName}
              onChange={(e) => setResearchName(e.target.value)}
              placeholder="e.g. Acme Logistics"
              className="mt-1"
              disabled={researching}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Context (optional)
            </label>
            <textarea
              value={researchContext}
              onChange={(e) => setResearchContext(e.target.value)}
              placeholder="What are you pitching? Any internal context that should shape the research?"
              disabled={researching}
              className="mt-1 w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          {researchError && (
            <div className="flex items-start gap-2 text-sm text-danger rounded-md border border-danger/30 bg-danger/[0.04] p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{researchError}</span>
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-muted-foreground">
              Uses Anthropic web search when an API key is set; falls back to a
              deterministic mock draft otherwise. Always review and edit the
              draft — research can be wrong.
            </p>
            <Button
              onClick={handleResearch}
              disabled={researching || !researchName.trim()}
            >
              {researching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Researching…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate draft
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            onSave={handleManualSave}
            warnings={warnings}
            saveLabel="Create customer"
          />
        </Card>
      )}
    </div>
  );
}
