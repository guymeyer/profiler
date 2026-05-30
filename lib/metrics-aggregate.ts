import type { DerivedMetric } from "@/lib/types";

// Group derived metrics by canonical name so the same metric observed in two
// different research artifacts shows as one row with two data points on the
// BU dashboard. Comparison is case-insensitive + whitespace-normalized.

export interface MetricGroup {
  key: string; // normalized name (group identity)
  displayName: string; // first non-empty original name
  kind: DerivedMetric["kind"];
  unit?: string;
  // Most recent observation drives the headline (latest value, arrow).
  latest: DerivedMetric;
  // Every observation in this group, newest first.
  observations: DerivedMetric[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function observedAt(m: DerivedMetric): number {
  if (m.asOfDate) {
    const t = Date.parse(m.asOfDate);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(m.createdAt) || 0;
}

export function groupMetrics(metrics: DerivedMetric[]): MetricGroup[] {
  const map = new Map<string, MetricGroup>();
  for (const m of metrics) {
    const key = normalize(m.name);
    const existing = map.get(key);
    if (existing) {
      existing.observations.push(m);
    } else {
      map.set(key, {
        key,
        displayName: m.name,
        kind: m.kind,
        unit: m.unit,
        latest: m,
        observations: [m],
      });
    }
  }
  for (const g of map.values()) {
    g.observations.sort((a, b) => observedAt(b) - observedAt(a));
    g.latest = g.observations[0];
    // Prefer a unit from any observation that has one.
    g.unit = g.observations.find((o) => o.unit)?.unit ?? g.unit;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}
