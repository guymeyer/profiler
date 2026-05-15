"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResearchForm } from "@/components/research/research-form";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";

export default function NewResearchPage() {
  const router = useRouter();
  const saveResearch = useProfilerStore((s) => s.saveResearch);
  const customers = useProfilerStore((s) => s.customers ?? {});
  const people = useEffectivePeople();

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/research"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All research
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Add research</h1>
        <p className="text-muted-foreground mt-1">
          Upload an interview, study, or summary. Linkage helps surface this
          research when running analyses for the relevant people or customers.
        </p>
      </header>

      <ResearchForm
        people={people}
        customers={Object.values(customers)}
        objectives={OBJECTIVES}
        saveLabel="Create research"
        onSubmit={(next) => {
          saveResearch(next);
          router.push(`/research/${next.id}`);
        }}
      />
    </div>
  );
}
