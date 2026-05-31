"use client";
import { useMemo } from "react";
import { useProfilerStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type {
  Company,
  Customer,
  CustomerCompany,
  InternalCompany,
} from "@/lib/types";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

// Read helpers for the unified Companies slice. The reader pattern is:
//
//   - useCompany(id)            — full Company record (kind discriminator)
//   - useInternalCompany()      — narrow to the singular internal Company
//   - useCustomerCompanies()    — every customer-kind, flattened to the
//                                 legacy `Customer` shape so consumers
//                                 don't need to know about properties.*
//
// The flattening hook is transitional: PR 20 lets every customer reader
// take a CustomerCompany directly and we drop the flatten step. For now
// it lets PR 16 migrate the source of truth without rewriting downstream
// types (AnalyzeInput.customer, prompts.serializeCustomer, etc.).

export function useCompany(id: string | undefined): Company | undefined {
  return useProfilerStore((s) => (id ? s.companies?.[id] : undefined));
}

export function useInternalCompany(): InternalCompany | undefined {
  return useProfilerStore((s) => {
    const c = s.companies?.[INTERNAL_COMPANY_ID];
    return c?.kind === "internal" ? c : undefined;
  });
}

function customerFromCompany(c: CustomerCompany): Customer {
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

// Map of every customer-kind Company keyed by id, flattened to the
// legacy Customer shape. Stable across unrelated store updates.
export function useCustomerCompanies(): Record<string, Customer> {
  return useProfilerStore(
    useShallow((s) => {
      const out: Record<string, Customer> = {};
      for (const [id, c] of Object.entries(s.companies ?? {})) {
        if (c.kind === "customer") out[id] = customerFromCompany(c);
      }
      return out;
    }),
  );
}

export function useCustomerCompaniesList(): Customer[] {
  const map = useCustomerCompanies();
  return useMemo(
    () =>
      Object.values(map).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [map],
  );
}
