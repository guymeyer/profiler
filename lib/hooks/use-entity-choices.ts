"use client";
import { useMemo } from "react";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import {
  DOCUMENT_KIND_LABELS,
  type Document,
} from "@/lib/types";
import type { EntityChoice } from "@/components/rich-editor";

// Build the mention/link picker corpus once and share it across every
// surface that hosts the editor. The shape mirrors what RichEditor's
// suggestion plugin expects.
//
// `excludeDocumentId` (optional) drops the named document from the doc
// list — pass the currently-open doc's id so it doesn't suggest itself
// as a citation target.
export function useEntityChoices(opts: {
  excludeDocumentId?: string;
} = {}): EntityChoice[] {
  const customers = useProfilerStore((s) => s.customers ?? {});
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const documents = useProfilerStore((s) => s.documents ?? {});
  const people = useEffectivePeople();
  const exclude = opts.excludeDocumentId;

  return useMemo(
    () => [
      ...people.map((p) => ({
        id: p.id,
        label: p.name,
        sub: `${p.title}${p.team ? ` · ${p.team}` : ""}`,
        kind: "person" as const,
      })),
      ...Object.values(customers).map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.industry,
        kind: "customer" as const,
      })),
      ...OBJECTIVES.map((o) => ({
        id: o.id,
        label: o.title,
        sub: o.description,
        kind: "objective" as const,
      })),
      ...Object.values(businessUnits).map((b) => ({
        id: b.id,
        label: b.name,
        sub: b.description,
        kind: "business-unit" as const,
      })),
      ...(Object.values(documents) as Document[])
        .filter((d) => d.id !== exclude)
        .map((d) => ({
          id: d.id,
          label: d.title,
          sub: DOCUMENT_KIND_LABELS[d.kind],
          kind: "document" as const,
        })),
    ],
    [people, customers, businessUnits, documents, exclude],
  );
}
