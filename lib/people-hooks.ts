"use client";
import { useEffect, useState } from "react";
import { PEOPLE } from "@/lib/data/people";
import { useProfilerStore } from "@/lib/store";
import type { Person } from "@/lib/types";

// Returns every effective person: seed + overlay + customer employees.
// Suitable for analysis pipelines and id-based lookups where it doesn't matter
// which "side" the person is on.
export function useEffectivePeople(): Person[] {
  const customProfiles = useProfilerStore((s) => s.customProfiles ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return PEOPLE;

  const merged = PEOPLE.map((p) => customProfiles[p.id] ?? p);
  const customOnly = Object.values(customProfiles).filter(
    (p) => !PEOPLE.some((seed) => seed.id === p.id),
  );
  return [...merged, ...customOnly];
}

// Internal people only — seed + custom overrides + new custom people that
// aren't tagged with a customerId. Use this on /people and in the audience
// builder's primary "People" picker.
export function useInternalPeople(): Person[] {
  return useEffectivePeople().filter((p) => !p.customerId);
}

// Just the employees attached to a specific customer.
export function useCustomerEmployees(customerId: string): Person[] {
  return useEffectivePeople().filter((p) => p.customerId === customerId);
}

export function useEffectivePerson(id: string): Person | undefined {
  return useEffectivePeople().find((p) => p.id === id);
}

export function isCustomProfile(id: string): boolean {
  return !PEOPLE.some((p) => p.id === id);
}

export function isOverriddenProfile(
  id: string,
  customProfiles: Record<string, Person>,
): boolean {
  return PEOPLE.some((p) => p.id === id) && !!customProfiles[id];
}

// Org-chart-friendly sort. Executive → senior → lead → ic. Alphabetical tie-break.
const LEVEL_ORDER: Record<Person["influence"], number> = {
  executive: 0,
  senior: 1,
  lead: 2,
  ic: 3,
};

export function sortByOrgChart(a: Person, b: Person): number {
  const la = LEVEL_ORDER[a.influence];
  const lb = LEVEL_ORDER[b.influence];
  if (la !== lb) return la - lb;
  const ra = a.rankWithinLevel ?? Number.POSITIVE_INFINITY;
  const rb = b.rankWithinLevel ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

export const INFLUENCE_LEVELS: Person["influence"][] = [
  "executive",
  "senior",
  "lead",
  "ic",
];

export const INFLUENCE_LABELS: Record<Person["influence"], string> = {
  executive: "Executive",
  senior: "Senior",
  lead: "Lead",
  ic: "IC",
};
