// Unified Company entity. Mirrors the Document consolidation: one type
// with a `kind` discriminator covering both your internal org and every
// customer company you partner with. Properties are kind-specific:
// internal carries (eventually) mission/values; customer carries the
// strategic intel that lived on the legacy `Customer` interface.
//
// People, OKRs, and BusinessUnits all gain a `companyId` so the same
// model (people + OKRs + BUs) renders for any Company — your own or a
// partner's. The /company route shows the internal one; each
// /customers/[id] route shows a customer's.

export type CompanyKind = "internal" | "customer";

export interface CompanyBase {
  id: string;
  kind: CompanyKind;
  name: string;
  summary: string;
  industry?: string;
  size?: string;
  region?: string;
  tags: string[];
  createdAt: string;
}

// Internal Company — your own org. Empty properties bag for now; future
// fields (mission, values, north-star metric) land here without a schema
// change at the union level.
export type InternalCompanyProperties = Record<string, never>;

export interface CustomerCompanyProperties {
  knownStakeholders: string[];
  buyingTriggers: string[];
  evaluationCriteria: string[];
  redFlags: string[];
  competitiveContext: string[];
  notes: string[];
  source: "manual" | "research";
  researchedAt?: string;
}

export type Company =
  | (CompanyBase & { kind: "internal"; properties: InternalCompanyProperties })
  | (CompanyBase & { kind: "customer"; properties: CustomerCompanyProperties });

export type InternalCompany = Extract<Company, { kind: "internal" }>;
export type CustomerCompany = Extract<Company, { kind: "customer" }>;

export type CompanyOfKind<K extends CompanyKind> = Extract<Company, { kind: K }>;
export type CompanyPropertiesOfKind<K extends CompanyKind> =
  CompanyOfKind<K>["properties"];

// Fixed id for the singular internal Company. One workspace = one
// internal Company. When Clerk multi-tenant lands the id can become the
// workspace id; the shape doesn't change.
export const INTERNAL_COMPANY_ID = "internal";

export const COMPANY_KIND_LABELS: Record<CompanyKind, string> = {
  internal: "Internal",
  customer: "Customer",
};

export function isCompanyKind(value: string): value is CompanyKind {
  return value === "internal" || value === "customer";
}
