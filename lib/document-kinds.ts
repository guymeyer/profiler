// Per-kind configuration registry for the unified Document detail page.
//
// Adding a new kind is two steps:
//   1. Add the kind + properties to lib/types/document.ts.
//   2. Add an entry below — labels, default properties, optional
//      PropertiesPanel component, optional metrics support, optional
//      prototype-prompt builder.
//
// Anything not in this registry uses sensible defaults (generic blank
// markdown, no properties panel, no metrics).

import type { ComponentType, ReactNode } from "react";
import type {
  Customer,
  DocumentKind,
  DocumentOfKind,
  Person,
  Objective,
  BusinessUnit,
  PRDStatus,
  MemoKind,
} from "@/lib/types";
import {
  DOCUMENT_KIND_LABELS,
  MEMO_KIND_LABELS,
  PRD_STATUS_LABELS,
} from "@/lib/types";

// Context handed to every panel/render function so they can resolve
// linked entities without each one re-reading the store.
export interface KindRenderContext {
  people: Person[];
  customers: Customer[];
  objectives: readonly Objective[];
  businessUnits: BusinessUnit[];
}

export interface PropertiesPanelProps<K extends DocumentKind> {
  document: DocumentOfKind<K>;
  onChange: (
    updater: (d: DocumentOfKind<K>) => DocumentOfKind<K>,
  ) => void;
  disabled?: boolean;
  ctx: KindRenderContext;
}

export interface DocumentKindConfig<K extends DocumentKind> {
  kind: K;
  label: string;
  eyebrow: string;
  idPrefix: string;
  // True if this kind participates in the derived-metrics extraction
  // pipeline. The detail page only shows the metrics section / "Re-extract"
  // button when this is set.
  hasMetrics: boolean;
  // True if this kind shows a "Copy prototype prompt" action.
  hasPrototypePrompt: boolean;
  // True if this kind is markdown-edited inline. Microsite/deck have
  // bespoke viewers and aren't editable through the unified detail page.
  isMarkdownEdited: boolean;
  defaultProperties(): DocumentOfKind<K>["properties"];
  renderMetaInline(
    d: DocumentOfKind<K>,
    ctx: KindRenderContext,
  ): ReactNode;
  PropertiesPanel?: ComponentType<PropertiesPanelProps<K>>;
}

// Bare config used by the registry until the kind ships UI. Lets unknown
// or stub kinds (note/postmortem/rfc) flow through the detail page with
// just a label.
function stubConfig<K extends DocumentKind>(
  kind: K,
  opts: Partial<DocumentKindConfig<K>> = {},
): DocumentKindConfig<K> {
  return {
    kind,
    label: DOCUMENT_KIND_LABELS[kind],
    eyebrow: DOCUMENT_KIND_LABELS[kind],
    idPrefix: kind.slice(0, 4),
    hasMetrics: false,
    hasPrototypePrompt: false,
    isMarkdownEdited: true,
    defaultProperties: () => ({}) as DocumentOfKind<K>["properties"],
    renderMetaInline: () => null,
    ...opts,
  };
}

// ── Research ──

const researchConfig: DocumentKindConfig<"research"> = {
  kind: "research",
  label: "Research",
  eyebrow: "Research",
  idPrefix: "res",
  hasMetrics: true,
  hasPrototypePrompt: true,
  isMarkdownEdited: true,
  defaultProperties: () => ({
    participants: [],
    methodology: undefined,
    conductedAt: undefined,
  }),
  renderMetaInline: (d) => {
    const date = d.properties.conductedAt
      ? new Date(d.properties.conductedAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
    return [d.source, date].filter(Boolean).join(" · ");
  },
};

// ── PRD ──

const prdConfig: DocumentKindConfig<"prd"> = {
  kind: "prd",
  label: "PRD",
  eyebrow: "PRD",
  idPrefix: "prd",
  hasMetrics: true,
  hasPrototypePrompt: false,
  isMarkdownEdited: true,
  defaultProperties: () => ({
    problem: "",
    solution: "",
    targetUsers: [],
    successMetrics: [],
    status: "draft" as PRDStatus,
    targetShipDate: undefined,
  }),
  renderMetaInline: (d, ctx) => {
    const parts: string[] = [];
    if (d.source) parts.push(d.source);
    parts.push(PRD_STATUS_LABELS[d.properties.status]);
    if (d.properties.targetShipDate) {
      parts.push(
        `ships ${new Date(d.properties.targetShipDate).toLocaleDateString(
          undefined,
          { year: "numeric", month: "short" },
        )}`,
      );
    }
    const bu = d.linkedBusinessUnitId
      ? ctx.businessUnits.find((b) => b.id === d.linkedBusinessUnitId)
      : null;
    if (bu) parts.push(bu.name);
    return parts.join(" · ");
  },
};

// ── Memo ──

const memoConfig: DocumentKindConfig<"memo"> = {
  kind: "memo",
  label: "Memo",
  eyebrow: "Memo",
  idPrefix: "memo",
  hasMetrics: true,
  hasPrototypePrompt: false,
  isMarkdownEdited: true,
  defaultProperties: () => ({
    memoKind: "other" as MemoKind,
    keyClaims: [],
    decisions: [],
  }),
  renderMetaInline: (d, ctx) => {
    const parts: string[] = [];
    parts.push(d.source ?? "Author unknown");
    parts.push(MEMO_KIND_LABELS[d.properties.memoKind]);
    const bu = d.linkedBusinessUnitId
      ? ctx.businessUnits.find((b) => b.id === d.linkedBusinessUnitId)
      : null;
    if (bu) parts.push(bu.name);
    return parts.join(" · ");
  },
};

// ── Microsite / Deck ──
// These have bespoke viewers under /synthesis/[id] and /decks/[id]. The
// unified detail page redirects to them rather than trying to render
// markdown through the same shell.

const micrositeConfig: DocumentKindConfig<"microsite"> = {
  kind: "microsite",
  label: "Microsite",
  eyebrow: "Synthesis",
  idPrefix: "syn",
  hasMetrics: false,
  hasPrototypePrompt: false,
  isMarkdownEdited: false,
  defaultProperties: () =>
    ({}) as DocumentOfKind<"microsite">["properties"],
  renderMetaInline: () => null,
};

const deckConfig: DocumentKindConfig<"deck"> = {
  kind: "deck",
  label: "Deck",
  eyebrow: "Deck",
  idPrefix: "deck",
  hasMetrics: false,
  hasPrototypePrompt: false,
  isMarkdownEdited: false,
  defaultProperties: () =>
    ({}) as DocumentOfKind<"deck">["properties"],
  renderMetaInline: () => null,
};

// Registry. Stub kinds (postmortem/rfc/note) flow through the generic
// markdown editor with no Properties panel.
const REGISTRY: {
  [K in DocumentKind]: DocumentKindConfig<K>;
} = {
  research: researchConfig,
  prd: prdConfig,
  memo: memoConfig,
  microsite: micrositeConfig,
  deck: deckConfig,
  postmortem: stubConfig("postmortem"),
  rfc: stubConfig("rfc"),
  note: stubConfig("note"),
};

export function getDocumentKindConfig<K extends DocumentKind>(
  kind: K,
): DocumentKindConfig<K> {
  return REGISTRY[kind];
}

// Slot for late-binding the Properties panel components. We can't import
// them eagerly here because they live in the (app) tree and import client-
// only modules; the detail page registers them at import time. Keeps the
// registry kind-agnostic at the type level.
export function registerPropertiesPanel<K extends DocumentKind>(
  kind: K,
  Panel: ComponentType<PropertiesPanelProps<K>>,
): void {
  (REGISTRY[kind] as DocumentKindConfig<K>).PropertiesPanel = Panel;
}
