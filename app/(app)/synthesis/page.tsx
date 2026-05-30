"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  InlineDatabase,
  DbDate,
  type InlineDatabaseColumn,
} from "@/components/ui/inline-database";
import { useProfilerStore } from "@/lib/store";
import type { Synthesis } from "@/lib/types";

export default function SynthesisListPage() {
  const syntheses = useProfilerStore((s) => s.syntheses ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const list = useMemo(
    () =>
      Object.values(syntheses).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [syntheses],
  );

  const columns: InlineDatabaseColumn<Synthesis>[] = [
    {
      key: "title",
      label: "Title",
      render: (s) => <span className="font-medium">{s.title}</span>,
      sortValue: (s) => s.title,
    },
    {
      key: "reports",
      label: "Reports",
      kind: "number",
      width: "w-[90px]",
      render: (s) => s.researchIds.length,
      sortValue: (s) => s.researchIds.length,
    },
    {
      key: "lenses",
      label: "Lenses",
      kind: "number",
      width: "w-[90px]",
      render: (s) =>
        s.outline?.lenses ? Object.keys(s.outline.lenses).length : 0,
    },
    {
      key: "model",
      label: "Model",
      kind: "muted",
      width: "w-[140px]",
      render: (s) =>
        s.generatedBy === "mock" ? "mock" : (s.model ?? "anthropic"),
    },
    {
      key: "createdAt",
      label: "Created",
      kind: "date",
      width: "w-[140px]",
      render: (s) => <DbDate iso={s.createdAt} />,
      sortValue: (s) => new Date(s.createdAt).getTime(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Synthesis"
        meta={
          <>
            Pick multiple research reports and generate a static microsite
            with a built-in lens dropdown. Viewers switch between a general
            read and reads for each common enterprise organization without
            regenerating.
          </>
        }
        actions={
          <Link href="/synthesis/new">
            <Button>New synthesis</Button>
          </Link>
        }
      />

      {!hydrated ? null : list.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-10 text-center">
          <h2 className="font-semibold mb-1">No syntheses yet</h2>
          <p className="text-[13px] text-muted-foreground mb-4 max-w-md mx-auto">
            Synthesize research reports into a multi-lens microsite that any
            org can read through its own lens — no regeneration required.
          </p>
          <Link href="/synthesis/new">
            <Button>New synthesis</Button>
          </Link>
        </div>
      ) : (
        <InlineDatabase
          rows={list}
          columns={columns}
          rowHref={(s) => `/synthesis/${s.id}`}
        />
      )}
    </div>
  );
}
