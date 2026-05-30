import type { Document, Person } from "@/lib/types";

// Pure graph relevance: given the artifact you're viewing and the team's
// roster, rank people by how likely they are to add value here. Two signals:
//
//   1. STATED  — overlap between the artifact's tags and each person's
//                expertiseAreas + activeWork + interests (both manual and
//                AI-auto-suggested).
//   2. DERIVED — co-occurrence: how often this person is linked to other
//                artifacts that share tags / customers / objectives with
//                the current artifact.
//
// No LLM. Deterministic. Each score component has a clear rationale string
// so the UI can explain WHY a person was surfaced.

// Anything carrying enough metadata to compute relevance against. A union
// of the existing document types so the same matcher handles research,
// PRDs, memos, and syntheses.
export type MatchableArtifact = {
  id: string;
  tags?: string[];
  linkedPersonIds?: string[];
  linkedCustomerIds?: string[];
  linkedObjectiveIds?: string[];
  linkedBusinessUnitId?: string;
};

export interface MatchedPerson {
  person: Person;
  score: number;
  reasons: string[];
}

interface CorpusForMatching {
  // Unified corpus — kind-agnostic. The matcher only cares about the
  // DocumentBase fields (tags, linkedPersonIds, etc.).
  documents: Document[];
}

const WEIGHT = {
  STATED_TAG_MATCH: 3,
  ALREADY_LINKED: 5, // boost: person is already linked to THIS artifact
  CO_OCCUR_TAG: 1, // person is linked to ANOTHER artifact sharing tags
  CO_OCCUR_CUSTOMER: 2,
  CO_OCCUR_OBJECTIVE: 2,
  CO_OCCUR_BU: 1.5,
} as const;

export function scoreRelevantPeople(args: {
  artifact: MatchableArtifact;
  people: Person[];
  corpus: CorpusForMatching;
  excludeIds?: string[]; // hide certain people (e.g. customer-employee profiles)
  limit?: number;
}): MatchedPerson[] {
  const { artifact, people, corpus } = args;
  const excludeIds = new Set(args.excludeIds ?? []);
  const limit = args.limit ?? 6;

  const artifactTagSet = lowerSet(artifact.tags);
  const artifactCustomerSet = new Set(artifact.linkedCustomerIds ?? []);
  const artifactObjectiveSet = new Set(artifact.linkedObjectiveIds ?? []);
  const artifactBu = artifact.linkedBusinessUnitId;
  const alreadyLinkedSet = new Set(artifact.linkedPersonIds ?? []);

  // Pre-compute, for each person, the set of artifacts they're linked to
  // (across kinds) so we can compute co-occurrence in one pass.
  const personArtifacts = buildPersonArtifactIndex(corpus);

  const out: MatchedPerson[] = [];

  for (const person of people) {
    if (excludeIds.has(person.id)) continue;
    if (person.customerId) continue; // external customer employees don't get recommended

    let score = 0;
    const reasons: string[] = [];

    // ── Already linked to this artifact ───────────────────────────────
    if (alreadyLinkedSet.has(person.id)) {
      score += WEIGHT.ALREADY_LINKED;
      reasons.push("already linked to this artifact");
    }

    // ── Stated expertise overlap ──────────────────────────────────────
    const expertiseTags = lowerSet([
      ...(person.expertiseAreas ?? []),
      ...(person.expertiseAreasAuto ?? []),
      ...(person.activeWork ?? []),
      ...(person.activeWorkAuto ?? []),
      ...(person.interests ?? []),
      ...(person.interestsAuto ?? []),
    ]);
    const expertiseOverlap: string[] = [];
    if (artifactTagSet.size > 0 && expertiseTags.size > 0) {
      for (const tag of artifactTagSet) {
        if (expertiseTags.has(tag)) expertiseOverlap.push(tag);
      }
    }
    if (expertiseOverlap.length > 0) {
      score += WEIGHT.STATED_TAG_MATCH * expertiseOverlap.length;
      reasons.push(
        `expertise overlap: ${expertiseOverlap.slice(0, 3).join(", ")}${expertiseOverlap.length > 3 ? `, +${expertiseOverlap.length - 3}` : ""}`,
      );
    }

    // ── Co-occurrence via shared tags / customers / objectives / BU ───
    const linkedArtifacts = personArtifacts.get(person.id) ?? [];
    let coTagMatches = 0;
    let coCustomerMatches = 0;
    let coObjectiveMatches = 0;
    let coBuMatches = 0;
    for (const a of linkedArtifacts) {
      if (a.id === artifact.id) continue;
      const aTags = lowerSet(a.tags);
      let tagOverlap = false;
      for (const t of artifactTagSet) {
        if (aTags.has(t)) {
          tagOverlap = true;
          break;
        }
      }
      if (tagOverlap) coTagMatches++;
      for (const cid of a.linkedCustomerIds ?? [])
        if (artifactCustomerSet.has(cid)) coCustomerMatches++;
      for (const oid of a.linkedObjectiveIds ?? [])
        if (artifactObjectiveSet.has(oid)) coObjectiveMatches++;
      if (artifactBu && a.linkedBusinessUnitId === artifactBu) coBuMatches++;
    }
    if (coTagMatches > 0) {
      score += WEIGHT.CO_OCCUR_TAG * coTagMatches;
      reasons.push(
        `linked to ${coTagMatches} adjacent ${pluralize(coTagMatches, "artifact")} by tag`,
      );
    }
    if (coCustomerMatches > 0) {
      score += WEIGHT.CO_OCCUR_CUSTOMER * coCustomerMatches;
      reasons.push(
        `linked to the same customer in ${coCustomerMatches} ${pluralize(coCustomerMatches, "artifact")}`,
      );
    }
    if (coObjectiveMatches > 0) {
      score += WEIGHT.CO_OCCUR_OBJECTIVE * coObjectiveMatches;
      reasons.push(
        `connected to the same objectives across ${coObjectiveMatches} ${pluralize(coObjectiveMatches, "artifact")}`,
      );
    }
    if (coBuMatches > 0) {
      score += WEIGHT.CO_OCCUR_BU * coBuMatches;
      reasons.push(
        `active in the same BU across ${coBuMatches} ${pluralize(coBuMatches, "artifact")}`,
      );
    }

    if (score > 0) out.push({ person, score, reasons });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

function buildPersonArtifactIndex(
  corpus: CorpusForMatching,
): Map<string, MatchableArtifact[]> {
  const map = new Map<string, MatchableArtifact[]>();
  const push = (personId: string, a: MatchableArtifact) => {
    const arr = map.get(personId);
    if (arr) arr.push(a);
    else map.set(personId, [a]);
  };

  for (const d of corpus.documents) {
    // Microsites/decks don't carry explicit person links today — skip them
    // as a corpus source. They surface via the research they cite instead.
    if (d.kind === "microsite" || d.kind === "deck") continue;
    if (d.linkedPersonIds.length === 0) continue;
    const m: MatchableArtifact = {
      id: d.id,
      tags: d.tags,
      linkedPersonIds: d.linkedPersonIds,
      linkedCustomerIds: d.linkedCustomerIds,
      linkedObjectiveIds: d.linkedObjectiveIds,
      linkedBusinessUnitId: d.linkedBusinessUnitId,
    };
    for (const pid of d.linkedPersonIds) push(pid, m);
  }
  return map;
}

function lowerSet(items?: string[]): Set<string> {
  const out = new Set<string>();
  if (!items) return out;
  for (const i of items) {
    const t = i.trim().toLowerCase();
    if (t.length > 0) out.add(t);
  }
  return out;
}

function pluralize(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
