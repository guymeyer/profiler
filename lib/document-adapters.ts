// Temporary adapters: convert a unified Document back to its legacy
// per-kind shape. Used at boundaries where downstream code (server
// actions, components, prompt builders) hasn't been migrated yet.
//
// PR 6 deletes this file along with the legacy types/actions.

import type {
  Document,
  Memo,
  PRD,
  ResearchArtifact,
  Synthesis,
  SlideDeck,
  MemoDocument,
  PRDDocument,
  ResearchDocument,
  MicrositeDocument,
  DeckDocument,
} from "@/lib/types";

export function documentToResearch(d: ResearchDocument): ResearchArtifact {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    content: d.content,
    source: d.source ?? "Internal",
    conductedAt: d.properties.conductedAt,
    participants: d.properties.participants,
    methodology: d.properties.methodology,
    tags: d.tags,
    linkedPersonIds: d.linkedPersonIds,
    linkedCustomerIds: d.linkedCustomerIds,
    linkedObjectiveIds: d.linkedObjectiveIds,
    uploadedFrom: d.uploadedFrom,
    sourceUrl: d.sourceUrl,
    locked: d.locked,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function documentToPRD(d: PRDDocument): PRD {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    problem: d.properties.problem,
    solution: d.properties.solution,
    targetUsers: d.properties.targetUsers,
    successMetrics: d.properties.successMetrics,
    status: d.properties.status,
    targetShipDate: d.properties.targetShipDate,
    content: d.content,
    source: d.source,
    tags: d.tags,
    linkedPersonIds: d.linkedPersonIds,
    linkedCustomerIds: d.linkedCustomerIds,
    linkedObjectiveIds: d.linkedObjectiveIds,
    linkedBusinessUnitId: d.linkedBusinessUnitId,
    uploadedFrom: d.uploadedFrom,
    sourceUrl: d.sourceUrl,
    locked: d.locked,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function documentToMemo(d: MemoDocument): Memo {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    memoKind: d.properties.memoKind,
    keyClaims: d.properties.keyClaims,
    decisions: d.properties.decisions,
    content: d.content,
    source: d.source,
    tags: d.tags,
    linkedPersonIds: d.linkedPersonIds,
    linkedCustomerIds: d.linkedCustomerIds,
    linkedObjectiveIds: d.linkedObjectiveIds,
    linkedBusinessUnitId: d.linkedBusinessUnitId,
    uploadedFrom: d.uploadedFrom,
    sourceUrl: d.sourceUrl,
    locked: d.locked,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function documentToSynthesis(d: MicrositeDocument): Synthesis {
  return {
    id: d.id,
    title: d.title,
    researchIds: d.properties.researchIds,
    outline: d.properties.outline,
    html: d.properties.html ?? "",
    modifier: d.properties.modifier,
    generatedBy: d.properties.generatedBy,
    model: d.properties.model,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export function documentToDeck(d: DeckDocument): SlideDeck {
  return {
    id: d.id,
    synthesisId: d.properties.synthesisId,
    title: d.title,
    audience: d.properties.audience,
    slides: d.properties.slides,
    generatedBy: d.properties.generatedBy,
    model: d.properties.model,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// Dispatching helpers when the caller has a `Document` without narrowing.
// Returns `undefined` for kinds with no legacy equivalent (note/postmortem/rfc).
export function documentToLegacy(d: Document):
  | { kind: "research"; item: ResearchArtifact }
  | { kind: "prd"; item: PRD }
  | { kind: "memo"; item: Memo }
  | { kind: "microsite"; item: Synthesis }
  | { kind: "deck"; item: SlideDeck }
  | undefined {
  switch (d.kind) {
    case "research":
      return { kind: "research", item: documentToResearch(d) };
    case "prd":
      return { kind: "prd", item: documentToPRD(d) };
    case "memo":
      return { kind: "memo", item: documentToMemo(d) };
    case "microsite":
      return { kind: "microsite", item: documentToSynthesis(d) };
    case "deck":
      return { kind: "deck", item: documentToDeck(d) };
    default:
      return undefined;
  }
}
