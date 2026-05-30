import type { Customer, Document, Person } from "@/lib/types";

// Auto-detect raw text mentions in a document body that aren't yet linked
// via the linked-* fields or an explicit @-mention chip. Surfaces them so
// the user can one-click connect the document to the entity.
//
// Conservative on false positives:
//  - Word-boundary matches only (so "Pat" doesn't match "patient").
//  - Names under 4 chars are ignored.
//  - First-name-only matches are skipped when the full name doesn't appear
//    — too risky on common first names.
//  - Entities already linked or already chip-mentioned are excluded.
//  - The current document never matches itself.

export type DetectedKind = "person" | "customer" | "document";

export interface DetectedMention {
  kind: DetectedKind;
  id: string;
  label: string;
  // The surrounding sentence so the user can see why this was flagged.
  snippet: string;
  // True if the entity is already linked via linked-* but the text was
  // never @-mentioned. Lets the UI nudge the user to "tag this @-mention
  // for clickability" rather than just "add the link."
  alreadyLinked: boolean;
}

const MIN_NAME_LENGTH = 4;
const SNIPPET_MAX = 160;

interface DetectInput {
  doc: Document;
  people: Person[];
  customers: Customer[];
  // Other documents in the corpus. Self-id is filtered automatically.
  otherDocuments: Document[];
}

export function detectUnlinkedMentions(input: DetectInput): DetectedMention[] {
  const { doc, people, customers, otherDocuments } = input;
  const body = doc.content;
  if (!body || body.length === 0) return [];

  // Pull the set of ids already mentioned via @-chip — those don't need
  // a suggestion, the chip is the link.
  const chipIds = extractChipIds(body);

  const out: DetectedMention[] = [];

  for (const p of people) {
    if (p.id === doc.id) continue; // shouldn't happen, but cheap.
    if (chipIds.has(p.id)) continue;
    const found = findNameMatch(body, p.name);
    if (!found) continue;
    out.push({
      kind: "person",
      id: p.id,
      label: p.name,
      snippet: found.snippet,
      alreadyLinked: doc.linkedPersonIds.includes(p.id),
    });
  }

  for (const c of customers) {
    if (chipIds.has(c.id)) continue;
    const found = findNameMatch(body, c.name);
    if (!found) continue;
    out.push({
      kind: "customer",
      id: c.id,
      label: c.name,
      snippet: found.snippet,
      alreadyLinked: doc.linkedCustomerIds.includes(c.id),
    });
  }

  for (const d of otherDocuments) {
    if (d.id === doc.id) continue;
    if (chipIds.has(d.id)) continue;
    const found = findNameMatch(body, d.title);
    if (!found) continue;
    out.push({
      kind: "document",
      id: d.id,
      label: d.title,
      snippet: found.snippet,
      // documents don't have a generic "linked" field — we treat them as
      // always "not linked yet" until a chip is inserted.
      alreadyLinked: false,
    });
  }

  // Sort: unlinked first (action needed), then by label.
  out.sort((a, b) => {
    if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
  return out;
}

function extractChipIds(body: string): Set<string> {
  // Mention chip serializes to markdown as @[Label](id). Pull every id.
  const ids = new Set<string>();
  const re = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function findNameMatch(
  body: string,
  name: string,
): { snippet: string } | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) return null;
  // Word-boundary, case-insensitive. Escape regex metacharacters in the
  // name so titles with punctuation match literally.
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  const match = re.exec(body);
  if (!match) return null;
  // Build a snippet ±60 chars around the match.
  const idx = match.index;
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + trimmed.length + 60);
  let snippet = body.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < body.length) snippet = snippet + "…";
  if (snippet.length > SNIPPET_MAX) snippet = snippet.slice(0, SNIPPET_MAX) + "…";
  return { snippet };
}
