import type { Customer } from "@/lib/types";

const SECTION_ALIASES: Record<string, keyof Customer> = {
  summary: "summary",
  overview: "summary",
  "known stakeholders": "knownStakeholders",
  stakeholders: "knownStakeholders",
  "buying triggers": "buyingTriggers",
  triggers: "buyingTriggers",
  "evaluation criteria": "evaluationCriteria",
  criteria: "evaluationCriteria",
  "red flags": "redFlags",
  risks: "redFlags",
  "competitive context": "competitiveContext",
  competitive: "competitiveContext",
  notes: "notes",
};

export function customerToMarkdown(c: Customer): string {
  const lines: string[] = [];
  lines.push(`# ${c.name}`);
  lines.push("");
  if (c.industry) lines.push(`- Industry: ${c.industry}`);
  if (c.size) lines.push(`- Size: ${c.size}`);
  if (c.region) lines.push(`- Region: ${c.region}`);
  lines.push(`- Tags: ${c.tags.join(", ")}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(c.summary || "");
  lines.push("");
  pushBullets(lines, "Known stakeholders", c.knownStakeholders);
  pushBullets(lines, "Buying triggers", c.buyingTriggers);
  pushBullets(lines, "Evaluation criteria", c.evaluationCriteria);
  pushBullets(lines, "Red flags", c.redFlags);
  pushBullets(lines, "Competitive context", c.competitiveContext);
  pushBullets(lines, "Notes", c.notes);
  return lines.join("\n").trimEnd() + "\n";
}

function pushBullets(out: string[], heading: string, items: string[]) {
  out.push(`## ${heading}`);
  out.push("");
  if (items.length === 0) out.push("- ");
  else for (const item of items) out.push(`- ${item}`);
  out.push("");
}

export interface ParsedCustomer {
  customer: Customer;
  warnings: string[];
}

export function markdownToCustomer(
  md: string,
  opts: { existingId?: string; existing?: Customer } = {},
): ParsedCustomer {
  const warnings: string[] = [];
  const lines = md.split(/\r?\n/);
  let name = "";
  let cursor = 0;
  while (cursor < lines.length) {
    const m = lines[cursor].match(/^#\s+(.+?)\s*$/);
    if (m) {
      name = m[1].trim();
      cursor++;
      break;
    }
    cursor++;
  }
  if (!name) warnings.push("Missing top-level heading for the customer name.");

  const meta: Record<string, string> = {};
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (/^##\s/.test(line)) break;
    const m = line.match(/^[-*]\s+([A-Za-z][A-Za-z\s]+?):\s*(.+?)\s*$/);
    if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
    cursor++;
  }

  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  let buf: string[] = [];
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) sections[current] = buf;
      current = m[1].trim().toLowerCase().replace(/[:.]+$/, "");
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) sections[current] = buf;

  const tags = (meta["tags"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const customer: Customer = {
    id: opts.existingId ?? slugifyId(name || "new-customer"),
    name: name || "New customer",
    industry: meta["industry"] || undefined,
    size: meta["size"] || undefined,
    region: meta["region"] || undefined,
    summary: "",
    knownStakeholders: [],
    buyingTriggers: [],
    evaluationCriteria: [],
    redFlags: [],
    competitiveContext: [],
    notes: [],
    tags,
    source: opts.existing?.source ?? "manual",
    researchedAt: opts.existing?.researchedAt,
    createdAt: opts.existing?.createdAt ?? new Date().toISOString(),
  };

  for (const [heading, sectionLines] of Object.entries(sections)) {
    const field = SECTION_ALIASES[heading];
    if (!field) {
      if (heading) warnings.push(`Unknown section "${heading}" — ignored.`);
      continue;
    }
    if (field === "summary") {
      customer.summary = sectionLines.join("\n").trim();
      continue;
    }
    const items = extractListItems(sectionLines);
    (customer as unknown as Record<string, string[]>)[field] = items;
  }

  return { customer, warnings };
}

function extractListItems(lines: string[]): string[] {
  const items: string[] = [];
  let current: string | null = null;
  for (const line of lines) {
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      if (current !== null) items.push(current.trim());
      current = bullet[1];
    } else if (line.trim() === "") {
      if (current !== null) {
        items.push(current.trim());
        current = null;
      }
    } else if (current !== null && /^\s+\S/.test(line)) {
      current += " " + line.trim();
    }
  }
  if (current !== null) items.push(current.trim());
  return items.filter(Boolean);
}

export function slugifyId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "customer"
  );
}

export const BLANK_CUSTOMER_MARKDOWN = `# New customer

- Industry:
- Size:
- Region:
- Tags:

## Summary

A short paragraph: who they are, why they matter, what's the current state of the relationship.

## Known stakeholders

-

## Buying triggers

-

## Evaluation criteria

-

## Red flags

-

## Competitive context

-

## Notes

-
`;
