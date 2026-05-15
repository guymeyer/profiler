import type { Person, InfluenceLevel, CommStyle } from "@/lib/types";

// Markdown round-trip for Person profiles. Lenient on read; canonical on write.

const SECTION_ALIASES: Record<string, keyof Person> = {
  summary: "summary",
  "communication preferences": "reviewPreferences",
  "review preferences": "reviewPreferences",
  "presentation preferences": "visualPreferences",
  "visual preferences": "visualPreferences",
  "decision triggers": "decisionTriggers",
  triggers: "decisionTriggers",
  "predictable objections": "objections",
  objections: "objections",
  "do's": "dos",
  dos: "dos",
  do: "dos",
  "don'ts": "donts",
  donts: "donts",
  "do not": "donts",
  "example guidance": "exampleGuidance",
  examples: "exampleGuidance",
};

const INFLUENCE_VALUES: InfluenceLevel[] = ["executive", "senior", "lead", "ic"];
const COMM_VALUES: CommStyle[] = [
  "data-driven",
  "narrative",
  "visual",
  "operational",
  "customer-centric",
  "consensus",
  "technical",
];

export function personToMarkdown(p: Person): string {
  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push("");
  lines.push(`- Title: ${p.title}`);
  lines.push(`- Team: ${p.team}`);
  lines.push(`- Influence: ${p.influence}`);
  lines.push(`- Communication style: ${p.commStyle.join(", ")}`);
  lines.push(`- Tags: ${p.tags.join(", ")}`);
  if (p.customerId) lines.push(`- Customer: ${p.customerId}`);
  if (typeof p.rankWithinLevel === "number") {
    lines.push(`- Rank: ${p.rankWithinLevel}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(p.summary);
  lines.push("");
  pushBullets(lines, "Communication preferences", p.reviewPreferences);
  pushBullets(lines, "Presentation preferences", p.visualPreferences);
  pushBullets(lines, "Decision triggers", p.decisionTriggers);
  pushBullets(lines, "Predictable objections", p.objections);
  pushBullets(lines, "Do's", p.dos);
  pushBullets(lines, "Don'ts", p.donts);
  pushNumbered(lines, "Example guidance", p.exampleGuidance);
  return lines.join("\n").trimEnd() + "\n";
}

function pushBullets(out: string[], heading: string, items: string[]) {
  out.push(`## ${heading}`);
  out.push("");
  if (items.length === 0) {
    out.push("- ");
  } else {
    for (const item of items) out.push(`- ${item}`);
  }
  out.push("");
}

function pushNumbered(out: string[], heading: string, items: string[]) {
  out.push(`## ${heading}`);
  out.push("");
  if (items.length === 0) {
    out.push("1. ");
  } else {
    items.forEach((item, i) => out.push(`${i + 1}. ${item}`));
  }
  out.push("");
}

export interface ParsedProfile {
  person: Person;
  warnings: string[];
}

export function markdownToPerson(
  md: string,
  opts: { existingId?: string } = {},
): ParsedProfile {
  const warnings: string[] = [];
  const lines = md.split(/\r?\n/);

  // Find name (first # heading at level 1)
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
  if (!name) {
    warnings.push("Missing top-level heading for the person's name.");
  }

  // Read metadata bullets until we hit a ## heading or non-meta line
  const meta: Record<string, string> = {};
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (/^##\s/.test(line)) break;
    const m = line.match(/^[-*]\s+([A-Za-z][A-Za-z\s]+?):\s*(.+?)\s*$/);
    if (m) {
      meta[m[1].trim().toLowerCase()] = m[2].trim();
    }
    cursor++;
  }

  // Parse sections by ## heading
  const sections: Record<string, string[]> = {};
  let currentHeading: string | null = null;
  let buf: string[] = [];
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (currentHeading) sections[currentHeading] = buf;
      currentHeading = m[1].trim().toLowerCase().replace(/[:.]+$/, "");
      buf = [];
    } else if (currentHeading) {
      buf.push(line);
    }
  }
  if (currentHeading) sections[currentHeading] = buf;

  const title = meta["title"] ?? "";
  const team = meta["team"] ?? "";
  const influenceRaw = (meta["influence"] ?? "").toLowerCase();
  const influence: InfluenceLevel = (INFLUENCE_VALUES.includes(
    influenceRaw as InfluenceLevel,
  )
    ? influenceRaw
    : "senior") as InfluenceLevel;
  if (influenceRaw && !INFLUENCE_VALUES.includes(influenceRaw as InfluenceLevel)) {
    warnings.push(
      `Unknown influence "${influenceRaw}". Defaulting to "senior". Valid: ${INFLUENCE_VALUES.join(", ")}.`,
    );
  }

  const commRaw = meta["communication style"] ?? meta["comm style"] ?? "";
  const commStyle: CommStyle[] = commRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => {
      if (!s) return false;
      if (COMM_VALUES.includes(s as CommStyle)) return true;
      warnings.push(`Unknown communication style "${s}" — dropped.`);
      return false;
    }) as CommStyle[];

  const tags = (meta["tags"] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const customerId = meta["customer"] || meta["customer id"] || undefined;
  const rankRaw = meta["rank"];
  const rankWithinLevel = rankRaw != null && /^\d+$/.test(rankRaw)
    ? Number(rankRaw)
    : undefined;

  // Default structure
  const person: Person = {
    id: opts.existingId ?? slugifyId(name || "new-person"),
    name: name || "New person",
    title,
    team,
    influence,
    commStyle,
    summary: "",
    reviewPreferences: [],
    visualPreferences: [],
    decisionTriggers: [],
    objections: [],
    dos: [],
    donts: [],
    exampleGuidance: [],
    tags,
    customerId,
    rankWithinLevel,
  };

  // Fill from sections
  for (const [heading, sectionLines] of Object.entries(sections)) {
    const field = SECTION_ALIASES[heading];
    if (!field) {
      if (heading) warnings.push(`Unknown section "${heading}" — ignored.`);
      continue;
    }
    if (field === "summary") {
      person.summary = sectionLines.join("\n").trim();
      continue;
    }
    const items = extractListItems(sectionLines);
    (person as unknown as Record<string, string[]>)[field] = items;
  }

  return { person, warnings };
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
      .slice(0, 60) || "person"
  );
}

export const BLANK_PERSON_MARKDOWN = `# New person

- Title:
- Team:
- Influence: senior
- Communication style: data-driven
- Tags:

## Summary

A short paragraph that captures how this person prefers work to be framed.

## Communication preferences

-

## Presentation preferences

-

## Decision triggers

-

## Predictable objections

-

## Do's

-

## Don'ts

-

## Example guidance

1.
`;
