"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OKRForm } from "@/components/okrs/okr-form";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";

export default function NewOKRPage() {
  const router = useRouter();
  const saveOKR = useProfilerStore((s) => s.saveOKR);
  const bus = useProfilerStore((s) => s.businessUnits ?? {});
  const people = useEffectivePeople();

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/okrs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All OKRs
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Add OKR</h1>
        <p className="text-muted-foreground mt-1">
          Define an Objective and its Key Results. Attach people whose
          recommendations should be aligned to it.
        </p>
      </header>

      <OKRForm
        people={people}
        bus={Object.values(bus)}
        saveLabel="Create OKR"
        onSubmit={(o) => {
          saveOKR(o);
          router.push(`/okrs/${o.id}`);
        }}
      />
    </div>
  );
}
