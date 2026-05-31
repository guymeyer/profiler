// Unified markdown round-trip for Documents.
//
// Each DocumentKind that supports markdown editing contributes a small
// spec (blank template, toMarkdown, fromMarkdown). The public API is
// kind-agnostic — call documentToMarkdown(d) / markdownToDocument(md)
// and the right spec dispatches off `d.kind`.
//
// The shared parsing helpers (parseDoc, extractListItems, parseCsv,
// parseDate, ParsedDoc) live here. They're still re-exported from
// lib/research-md.ts so legacy callers keep working until PR 6.

import type {
  Document,
  DocumentBase,
  DocumentKind,
  DocumentOfKind,
  DocumentPropertiesOfKind,
  MemoKind,
  PRDStatus,
} from "@/lib/types";
import { slugifyId } from "@/lib/profile-md";

// ───────── Shared markdown-doc parsing primitives ─────────

export interface ParsedDoc {
  name: string;
  meta: Record<string, string>;
  sections: Record<string, string[]>;
}

export function parseDoc(
  md: string,
  opts: { terminalAliases?: string[] } = {},
): ParsedDoc {
  // Terminal sections "swallow" all following ## headings as part of their
  // own content rather than starting new sections. Lets the body capture
  // LLM-produced sub-structure (## TL;DR, ## Key metrics, ## Findings)
  // without each one becoming an unknown top-level section that gets
  // dropped during round-trip.
  const terminal = new Set(
    (opts.terminalAliases ?? []).map((a) => a.toLowerCase()),
  );

  const lines = md.split(/\r?\n/);
  let cursor = 0;

  let name = "";
  while (cursor < lines.length) {
    const m = lines[cursor].match(/^#\s+(.+?)\s*$/);
    if (m) {
      name = m[1].trim();
      cursor++;
      break;
    }
    cursor++;
  }

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

  const sections: Record<string, string[]> = {};
  let currentHeading: string | null = null;
  let inTerminal = false;
  let buf: string[] = [];
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !inTerminal) {
      if (currentHeading) sections[currentHeading] = buf;
      currentHeading = m[1].trim().toLowerCase().replace(/[:.]+$/, "");
      buf = [];
      if (terminal.has(currentHeading)) inTerminal = true;
    } else if (currentHeading) {
      buf.push(line);
    }
  }
  if (currentHeading) sections[currentHeading] = buf;

  return { name, meta, sections };
}

export function extractListItems(lines: string[]): string[] {
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

export function parseCsv(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseDate(
  s: string | undefined,
  warnings: string[],
): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    warnings.push(`Couldn't parse date "${s}" — leaving empty.`);
    return undefined;
  }
  return new Date(t).toISOString();
}

// ───────── Shared header serialization ─────────
// The meta bullets every kind shares: tags, BU, linked entities. Kind-
// specific meta (Owner, Status, Conducted, Author, Kind, etc.) is emitted
// by the spec before this footer.

function emitLinkedMeta(d: DocumentBase): string[] {
  const out: string[] = [];
  out.push(`- Tags: ${d.tags.join(", ")}`);
  if (d.linkedBusinessUnitId)
    out.push(`- Business unit: ${d.linkedBusinessUnitId}`);
  if (d.linkedPersonIds.length > 0)
    out.push(`- People: ${d.linkedPersonIds.join(", ")}`);
  if (d.linkedCustomerIds.length > 0)
    out.push(`- Customers: ${d.linkedCustomerIds.join(", ")}`);
  if (d.linkedObjectiveIds.length > 0)
    out.push(`- Objectives: ${d.linkedObjectiveIds.join(", ")}`);
  return out;
}

interface SharedBaseRead {
  tags: string[];
  linkedPersonIds: string[];
  linkedCustomerIds: string[];
  linkedObjectiveIds: string[];
  linkedBusinessUnitId?: string;
}

function readLinkedMeta(meta: Record<string, string>): SharedBaseRead {
  return {
    tags: parseCsv(meta["tags"]),
    linkedPersonIds: parseCsv(meta["people"]),
    linkedCustomerIds: parseCsv(meta["customers"]),
    linkedObjectiveIds: parseCsv(meta["objectives"]),
    linkedBusinessUnitId: meta["business unit"] || meta["bu"] || undefined,
  };
}

// ───────── Per-kind spec registry ─────────

interface KindMarkdownSpec<K extends DocumentKind> {
  blank: string;
  toMarkdown(d: DocumentOfKind<K>): string;
  fromMarkdown(
    parsed: ParsedDoc,
    opts: { existing?: DocumentOfKind<K> },
  ): { document: DocumentOfKind<K>; warnings: string[] };
}

const STATUS_VALUES: PRDStatus[] = ["draft", "review", "approved", "shipped"];
const MEMO_KIND_VALUES: MemoKind[] = [
  "strategy",
  "brief",
  "post-mortem",
  "market",
  "other",
];

// ── Research ──

const RESEARCH_SECTION_ALIASES: Record<
  string,
  "summary" | "methodology" | "participants" | "content"
> = {
  summary: "summary",
  methodology: "methodology",
  participants: "participants",
  body: "content",
  content: "content",
};

const researchSpec: KindMarkdownSpec<"research"> = {
  blank: `# Untitled research

- Source: Internal
- Conducted: ${new Date().toISOString().slice(0, 10)}
- Tags:
- People:
- Customers:
- Objectives:

## Summary

One to three sentences. What was studied, what was found.

## Methodology

How it was conducted in one short paragraph.

## Participants

-

## Body

The full content of the research goes here.
`,

  toMarkdown(d) {
    const lines: string[] = [];
    lines.push(`# ${d.title}`);
    lines.push("");
    lines.push(`- Source: ${d.source ?? "Internal"}`);
    if (d.properties.conductedAt)
      lines.push(`- Conducted: ${d.properties.conductedAt.slice(0, 10)}`);
    lines.push(...emitLinkedMeta(d));
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(d.summary || "");
    lines.push("");
    if (d.properties.methodology) {
      lines.push("## Methodology");
      lines.push("");
      lines.push(d.properties.methodology);
      lines.push("");
    }
    if (d.properties.participants.length > 0) {
      lines.push("## Participants");
      lines.push("");
      for (const p of d.properties.participants) lines.push(`- ${p}`);
      lines.push("");
    }
    lines.push("## Body");
    lines.push("");
    lines.push(d.content || "");
    lines.push("");
    return lines.join("\n").trimEnd() + "\n";
  },

  fromMarkdown(parsed, { existing }) {
    const warnings: string[] = [];
    const { name, meta, sections } = parsed;
    if (!name) warnings.push("Missing top-level heading for the title.");

    const source = meta["source"] ?? existing?.source ?? "Internal";
    const conductedAt =
      parseDate(meta["conducted"], warnings) ??
      existing?.properties.conductedAt;
    const linked = readLinkedMeta(meta);

    let summary = "";
    let methodology: string | undefined;
    const participants: string[] = [];
    let content = "";

    for (const [heading, sectionLines] of Object.entries(sections)) {
      const field = RESEARCH_SECTION_ALIASES[heading];
      if (!field) {
        warnings.push(`Unknown section "${heading}" — ignored.`);
        continue;
      }
      if (field === "summary") summary = sectionLines.join("\n").trim();
      else if (field === "methodology")
        methodology = sectionLines.join("\n").trim() || undefined;
      else if (field === "participants")
        participants.push(...extractListItems(sectionLines));
      else if (field === "content") content = sectionLines.join("\n").trim();
    }

    const now = new Date().toISOString();
    const id =
      existing?.id ??
      `res_${Date.now().toString(36)}_${slugifyId(name || "untitled").slice(0, 8)}`;

    const document: DocumentOfKind<"research"> = {
      id,
      kind: "research",
      title: name || "Untitled research",
      summary,
      content,
      source,
      tags: linked.tags,
      linkedPersonIds: linked.linkedPersonIds,
      linkedCustomerIds: linked.linkedCustomerIds,
      linkedObjectiveIds: linked.linkedObjectiveIds,
      linkedBusinessUnitId: linked.linkedBusinessUnitId,
      uploadedFrom: existing?.uploadedFrom,
      sourceUrl: existing?.sourceUrl,
      locked: existing?.locked,
      originalContent: existing?.originalContent,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
      properties: {
        participants,
        methodology,
        conductedAt,
      },
    };

    return { document, warnings };
  },
};

// ── PRD ──

const PRD_SECTION_ALIASES: Record<
  string,
  "summary" | "problem" | "solution" | "targetUsers" | "successMetrics" | "content"
> = {
  summary: "summary",
  problem: "problem",
  "proposed solution": "solution",
  solution: "solution",
  "target users": "targetUsers",
  "success metrics": "successMetrics",
  "target metrics": "successMetrics",
  body: "content",
  content: "content",
};

const prdSpec: KindMarkdownSpec<"prd"> = {
  blank: `# Untitled PRD

- Owner:
- Status: draft
- Target ship:
- Tags:
- Business unit:
- People:
- Customers:
- Objectives:

## Summary

1-3 sentences. What we're building, for whom, and why now.

## Problem

The user / business problem this PRD addresses.

## Proposed solution

The capability-level approach. Not implementation detail.

## Target users

-

## Success metrics

-

## Body

The full PRD content goes here.
`,

  toMarkdown(d) {
    const lines: string[] = [];
    lines.push(`# ${d.title}`);
    lines.push("");
    if (d.source) lines.push(`- Owner: ${d.source}`);
    lines.push(`- Status: ${d.properties.status}`);
    if (d.properties.targetShipDate)
      lines.push(`- Target ship: ${d.properties.targetShipDate.slice(0, 10)}`);
    lines.push(...emitLinkedMeta(d));
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(d.summary || "");
    lines.push("");
    lines.push("## Problem");
    lines.push("");
    lines.push(d.properties.problem || "");
    lines.push("");
    lines.push("## Proposed solution");
    lines.push("");
    lines.push(d.properties.solution || "");
    lines.push("");
    lines.push("## Target users");
    lines.push("");
    if (d.properties.targetUsers.length === 0) lines.push("- ");
    else for (const u of d.properties.targetUsers) lines.push(`- ${u}`);
    lines.push("");
    lines.push("## Success metrics");
    lines.push("");
    if (d.properties.successMetrics.length === 0) lines.push("- ");
    else for (const m of d.properties.successMetrics) lines.push(`- ${m}`);
    lines.push("");
    lines.push("## Body");
    lines.push("");
    lines.push(d.content || "");
    lines.push("");
    return lines.join("\n").trimEnd() + "\n";
  },

  fromMarkdown(parsed, { existing }) {
    const warnings: string[] = [];
    const { name, meta, sections } = parsed;
    if (!name) warnings.push("Missing top-level heading for the title.");

    const statusRaw = (meta["status"] ?? "draft").toLowerCase();
    const status: PRDStatus = STATUS_VALUES.includes(statusRaw as PRDStatus)
      ? (statusRaw as PRDStatus)
      : "draft";
    if (meta["status"] && !STATUS_VALUES.includes(statusRaw as PRDStatus)) {
      warnings.push(
        `Unknown status "${meta["status"]}" — defaulting to "draft". Valid: ${STATUS_VALUES.join(", ")}.`,
      );
    }

    const targetShipDate =
      parseDate(meta["target ship"], warnings) ??
      existing?.properties.targetShipDate;
    const source = meta["owner"] ?? meta["source"] ?? existing?.source;
    const linked = readLinkedMeta(meta);

    let summary = "";
    let problem = "";
    let solution = "";
    const targetUsers: string[] = [];
    const successMetrics: string[] = [];
    let content = "";

    for (const [heading, sectionLines] of Object.entries(sections)) {
      const field = PRD_SECTION_ALIASES[heading];
      if (!field) {
        warnings.push(`Unknown section "${heading}" — ignored.`);
        continue;
      }
      if (field === "summary") summary = sectionLines.join("\n").trim();
      else if (field === "problem") problem = sectionLines.join("\n").trim();
      else if (field === "solution") solution = sectionLines.join("\n").trim();
      else if (field === "targetUsers")
        targetUsers.push(...extractListItems(sectionLines));
      else if (field === "successMetrics")
        successMetrics.push(...extractListItems(sectionLines));
      else if (field === "content") content = sectionLines.join("\n").trim();
    }

    const now = new Date().toISOString();
    const id =
      existing?.id ??
      `prd_${Date.now().toString(36)}_${slugifyId(name || "untitled").slice(0, 8)}`;

    const document: DocumentOfKind<"prd"> = {
      id,
      kind: "prd",
      title: name || "Untitled PRD",
      summary,
      content,
      source,
      tags: linked.tags,
      linkedPersonIds: linked.linkedPersonIds,
      linkedCustomerIds: linked.linkedCustomerIds,
      linkedObjectiveIds: linked.linkedObjectiveIds,
      linkedBusinessUnitId: linked.linkedBusinessUnitId,
      uploadedFrom: existing?.uploadedFrom,
      sourceUrl: existing?.sourceUrl,
      locked: existing?.locked,
      originalContent: existing?.originalContent,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
      properties: {
        problem,
        solution,
        targetUsers,
        successMetrics,
        status,
        targetShipDate,
      },
    };

    return { document, warnings };
  },
};

// ── Memo ──

const MEMO_SECTION_ALIASES: Record<
  string,
  "summary" | "keyClaims" | "decisions" | "content"
> = {
  summary: "summary",
  "key claims": "keyClaims",
  claims: "keyClaims",
  decisions: "decisions",
  "decisions / recommendations": "decisions",
  recommendations: "decisions",
  body: "content",
  content: "content",
};

const memoSpec: KindMarkdownSpec<"memo"> = {
  blank: `# Untitled memo

- Author:
- Kind: other
- Tags:
- Business unit:
- People:
- Customers:
- Objectives:

## Summary

1-3 sentences. What the memo argues, recommends, or reports.

## Key claims

-

## Decisions

-

## Body

The full memo content goes here.
`,

  toMarkdown(d) {
    const lines: string[] = [];
    lines.push(`# ${d.title}`);
    lines.push("");
    if (d.source) lines.push(`- Author: ${d.source}`);
    lines.push(`- Kind: ${d.properties.memoKind}`);
    lines.push(...emitLinkedMeta(d));
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(d.summary || "");
    lines.push("");
    lines.push("## Key claims");
    lines.push("");
    if (d.properties.keyClaims.length === 0) lines.push("- ");
    else for (const c of d.properties.keyClaims) lines.push(`- ${c}`);
    lines.push("");
    lines.push("## Decisions");
    lines.push("");
    if (d.properties.decisions.length === 0) lines.push("- ");
    else for (const dec of d.properties.decisions) lines.push(`- ${dec}`);
    lines.push("");
    lines.push("## Body");
    lines.push("");
    lines.push(d.content || "");
    lines.push("");
    return lines.join("\n").trimEnd() + "\n";
  },

  fromMarkdown(parsed, { existing }) {
    const warnings: string[] = [];
    const { name, meta, sections } = parsed;
    if (!name) warnings.push("Missing top-level heading for the title.");

    const memoKindRaw = (meta["kind"] ?? "other").toLowerCase();
    const memoKind: MemoKind = MEMO_KIND_VALUES.includes(memoKindRaw as MemoKind)
      ? (memoKindRaw as MemoKind)
      : "other";
    if (
      meta["kind"] &&
      !MEMO_KIND_VALUES.includes(memoKindRaw as MemoKind)
    ) {
      warnings.push(
        `Unknown memo kind "${meta["kind"]}" — defaulting to "other". Valid: ${MEMO_KIND_VALUES.join(", ")}.`,
      );
    }

    const source = meta["author"] ?? meta["source"] ?? existing?.source;
    const linked = readLinkedMeta(meta);

    let summary = "";
    const keyClaims: string[] = [];
    const decisions: string[] = [];
    let content = "";

    for (const [heading, sectionLines] of Object.entries(sections)) {
      const field = MEMO_SECTION_ALIASES[heading];
      if (!field) {
        warnings.push(`Unknown section "${heading}" — ignored.`);
        continue;
      }
      if (field === "summary") summary = sectionLines.join("\n").trim();
      else if (field === "keyClaims")
        keyClaims.push(...extractListItems(sectionLines));
      else if (field === "decisions")
        decisions.push(...extractListItems(sectionLines));
      else if (field === "content") content = sectionLines.join("\n").trim();
    }

    const now = new Date().toISOString();
    const id =
      existing?.id ??
      `memo_${Date.now().toString(36)}_${slugifyId(name || "untitled").slice(0, 8)}`;

    const document: DocumentOfKind<"memo"> = {
      id,
      kind: "memo",
      title: name || "Untitled memo",
      summary,
      content,
      source,
      tags: linked.tags,
      linkedPersonIds: linked.linkedPersonIds,
      linkedCustomerIds: linked.linkedCustomerIds,
      linkedObjectiveIds: linked.linkedObjectiveIds,
      linkedBusinessUnitId: linked.linkedBusinessUnitId,
      uploadedFrom: existing?.uploadedFrom,
      sourceUrl: existing?.sourceUrl,
      locked: existing?.locked,
      originalContent: existing?.originalContent,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
      properties: {
        memoKind,
        keyClaims,
        decisions,
      },
    };

    return { document, warnings };
  },
};

// ── Generic spec (fallback for kinds without typed markdown sections) ──
// Used by `note` today and as the safety net for unknown kinds. Title +
// summary + body, no typed properties read or written.

const GENERIC_BLANK = `# Untitled

- Tags:
- People:
- Customers:
- Objectives:

## Summary

One to three sentences.

## Body

Write here.
`;

function genericToMarkdown(d: Document): string {
  const lines: string[] = [];
  lines.push(`# ${d.title}`);
  lines.push("");
  if (d.source) lines.push(`- Source: ${d.source}`);
  lines.push(...emitLinkedMeta(d));
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(d.summary || "");
  lines.push("");
  lines.push("## Body");
  lines.push("");
  lines.push(d.content || "");
  lines.push("");
  return lines.join("\n").trimEnd() + "\n";
}

function genericFromMarkdown<K extends DocumentKind>(
  kind: K,
  parsed: ParsedDoc,
  opts: { existing?: DocumentOfKind<K> },
): { document: DocumentOfKind<K>; warnings: string[] } {
  const warnings: string[] = [];
  const { name, meta, sections } = parsed;
  if (!name) warnings.push("Missing top-level heading for the title.");

  const source = meta["source"] ?? opts.existing?.source;
  const linked = readLinkedMeta(meta);

  let summary = "";
  let content = "";
  for (const [heading, sectionLines] of Object.entries(sections)) {
    if (heading === "summary") summary = sectionLines.join("\n").trim();
    else if (heading === "body" || heading === "content")
      content = sectionLines.join("\n").trim();
    else warnings.push(`Unknown section "${heading}" — ignored.`);
  }

  const now = new Date().toISOString();
  const id =
    opts.existing?.id ??
    `${kind.slice(0, 4)}_${Date.now().toString(36)}_${slugifyId(name || "untitled").slice(0, 8)}`;

  const properties =
    opts.existing?.properties ??
    (emptyPropertiesFor(kind) as DocumentPropertiesOfKind<K>);

  const document = {
    id,
    kind,
    title: name || "Untitled",
    summary,
    content,
    source,
    tags: linked.tags,
    linkedPersonIds: linked.linkedPersonIds,
    linkedCustomerIds: linked.linkedCustomerIds,
    linkedObjectiveIds: linked.linkedObjectiveIds,
    linkedBusinessUnitId: linked.linkedBusinessUnitId,
    uploadedFrom: opts.existing?.uploadedFrom,
    sourceUrl: opts.existing?.sourceUrl,
    locked: opts.existing?.locked,
    createdAt: opts.existing?.createdAt ?? now,
    updatedAt: opts.existing ? now : undefined,
    properties,
  } as DocumentOfKind<K>;

  return { document, warnings };
}

// Empty-bag defaults for kinds without first-class markdown specs. Used
// only by the generic fallback; richly-typed kinds construct properties
// inline.
function emptyPropertiesFor(kind: DocumentKind): unknown {
  switch (kind) {
    case "postmortem":
    case "rfc":
    case "note":
      return {};
    case "microsite":
    case "deck":
      // These kinds aren't really markdown-edited — generic round-trip
      // would lose their structured payload. Return a minimal stub so
      // type-checking passes; callers shouldn't reach here in practice.
      return {} as unknown;
    default:
      return {};
  }
}

// ───────── Registry + public API ─────────

const SPECS: Partial<{
  [K in DocumentKind]: KindMarkdownSpec<K>;
}> = {
  research: researchSpec,
  prd: prdSpec,
  memo: memoSpec,
};

export function documentToMarkdown(d: Document): string {
  const spec = SPECS[d.kind] as KindMarkdownSpec<typeof d.kind> | undefined;
  if (spec) return spec.toMarkdown(d as DocumentOfKind<typeof d.kind>);
  return genericToMarkdown(d);
}

export interface ParsedDocument<K extends DocumentKind = DocumentKind> {
  document: DocumentOfKind<K>;
  warnings: string[];
}

// Round-trip from markdown back to a Document. Pass `existing` (preferred)
// or `kind` to pick the right spec. If neither is supplied, falls back to
// the generic `note` shape.
export function markdownToDocument<K extends DocumentKind>(
  md: string,
  opts: { existing?: DocumentOfKind<K>; kind?: K } = {},
): ParsedDocument<K> {
  const kind = (opts.existing?.kind ?? opts.kind ?? ("note" as DocumentKind)) as K;
  // Body is always the terminal section: anything ## inside the body
  // (TL;DR, Key metrics, Findings, etc.) belongs to the body, not as a
  // sibling top-level section. Without this, LLM-produced body
  // sub-structure would be silently dropped on round-trip.
  const parsed = parseDoc(md, { terminalAliases: ["body", "content"] });
  const spec = SPECS[kind] as KindMarkdownSpec<K> | undefined;
  if (spec) return spec.fromMarkdown(parsed, { existing: opts.existing });
  return genericFromMarkdown<K>(kind, parsed, opts);
}

export function blankMarkdownFor(kind: DocumentKind): string {
  const spec = SPECS[kind];
  return spec?.blank ?? GENERIC_BLANK;
}
