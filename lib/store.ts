"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  RecommendationResult,
  ResultFeedback,
  Person,
  Customer,
  Company,
  BusinessUnit,
  OKR,
  DerivedMetric,
  BURecommendationSet,
  Document,
} from "@/lib/types";
import { migrateV1ToV2, migrateV2ToV3 } from "@/lib/store-migrations";

interface AudienceSelection {
  personIds: string[];
  objectiveIds: string[];
}

interface SavedAudience extends AudienceSelection {
  id: string;
  name: string;
  createdAt: string;
}

interface RecentResult {
  id: string;
  title: string;
  fitScore: number;
  personIds: string[];
  objectiveIds: string[];
  createdAt: string;
}

interface ProfilerStore {
  // Audience builder state
  selectedPersonIds: string[];
  selectedObjectiveIds: string[];
  audienceIntent: string;
  togglePerson: (id: string) => void;
  toggleObjective: (id: string) => void;
  setSelection: (sel: Partial<AudienceSelection>) => void;
  setAudienceIntent: (intent: string) => void;
  clearSelection: () => void;

  // Saved audiences
  savedAudiences: SavedAudience[];
  saveAudience: (name: string) => void;
  deleteAudience: (id: string) => void;
  loadAudience: (id: string) => void;

  // Recents
  recentResults: RecentResult[];
  addRecentResult: (r: RecentResult) => void;
  recentlyViewedPersonIds: string[];
  noteViewedPerson: (id: string) => void;

  // Stored results (keyed by id)
  results: Record<string, RecommendationResult>;
  storeResult: (r: RecommendationResult) => void;
  getResult: (id: string) => RecommendationResult | undefined;
  setResultFeedback: (
    id: string,
    feedback: ResultFeedback | null,
  ) => void;

  // Results view preferences
  resultsDepth: 1 | 2 | 3 | 4;
  setResultsDepth: (d: 1 | 2 | 3 | 4) => void;

  // Whether the document detail page's Properties panel starts open. Global
  // preference so closing it on one doc keeps it closed on the next.
  propertiesPanelOpen: boolean;
  setPropertiesPanelOpen: (open: boolean) => void;

  // Editable people overlay (override seed by id; new custom people too)
  customProfiles: Record<string, Person>;
  saveProfile: (p: Person) => void;
  deleteProfile: (id: string) => void;

  // Customer compatibility shims. The legacy `customers` slice is gone;
  // these accept the legacy Customer shape (still used by server actions
  // and the markdown round-trip) and dispatch to the unified companies
  // store internally. Removed in a future PR once those callers move to
  // CustomerCompany directly.
  saveCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  selectedCustomerId?: string;
  setSelectedCustomerId: (id: string | undefined) => void;

  // Unified Companies — your internal org + every customer org. Source
  // of truth for People / OKRs / BusinessUnits scoping.
  companies: Record<string, Company>;
  saveCompany: (c: Company) => void;
  deleteCompany: (id: string) => void;

  // Document selection cursor used by audience-builder / synthesis flows.
  // Keyed off document ids regardless of kind — kept on the store so
  // selections survive across page transitions.
  selectedResearchIds: string[];
  toggleResearch: (id: string) => void;
  clearSelectedResearch: () => void;

  // Business units
  businessUnits: Record<string, BusinessUnit>;
  saveBusinessUnit: (b: BusinessUnit) => void;
  deleteBusinessUnit: (id: string) => void;

  // OKRs
  okrs: Record<string, OKR>;
  saveOKR: (o: OKR) => void;
  deleteOKR: (id: string) => void;
  selectedOKRIds: string[];
  toggleOKR: (id: string) => void;
  clearSelectedOKRs: () => void;

  // Derived metrics (auto-extracted from research / PRDs / memos)
  metrics: Record<string, DerivedMetric>;
  // Replace ALL metrics tied to one document. Used by extract flows so
  // re-running extraction on a document doesn't leave stale rows.
  // sourceKind narrows the filter — passing it explicitly avoids reading
  // the (possibly stale) document slice.
  replaceMetricsForDocument: (
    documentId: string,
    sourceKind: "research" | "prd" | "memo",
    next: DerivedMetric[],
  ) => void;
  deleteMetric: (id: string) => void;

  // BU-level recommendation rollups, one per businessUnitId.
  buRecommendations: Record<string, BURecommendationSet>;
  saveBURecommendations: (r: BURecommendationSet) => void;
  deleteBURecommendations: (businessUnitId: string) => void;

  // Unified documents — the source of truth for research, PRDs, memos,
  // microsites, decks, and future kinds (postmortem/rfc/note).
  documents: Record<string, Document>;
  saveDocument: (d: Document) => void;
  deleteDocument: (id: string) => void;
}

export const useProfilerStore = create<ProfilerStore>()(
  persist(
    (set, get) => ({
      selectedPersonIds: [],
      selectedObjectiveIds: [],
      audienceIntent: "",
      setAudienceIntent: (intent) => set({ audienceIntent: intent }),
      togglePerson: (id) =>
        set((s) => ({
          selectedPersonIds: s.selectedPersonIds.includes(id)
            ? s.selectedPersonIds.filter((x) => x !== id)
            : [...s.selectedPersonIds, id],
        })),
      toggleObjective: (id) =>
        set((s) => ({
          selectedObjectiveIds: s.selectedObjectiveIds.includes(id)
            ? s.selectedObjectiveIds.filter((x) => x !== id)
            : [...s.selectedObjectiveIds, id],
        })),
      setSelection: (sel) =>
        set((s) => ({
          selectedPersonIds: sel.personIds ?? s.selectedPersonIds,
          selectedObjectiveIds: sel.objectiveIds ?? s.selectedObjectiveIds,
        })),
      clearSelection: () =>
        set({
          selectedPersonIds: [],
          selectedObjectiveIds: [],
          audienceIntent: "",
          selectedResearchIds: [],
          selectedOKRIds: [],
        }),

      savedAudiences: [],
      saveAudience: (name) =>
        set((s) => ({
          savedAudiences: [
            {
              id: `aud_${Date.now().toString(36)}`,
              name,
              personIds: s.selectedPersonIds,
              objectiveIds: s.selectedObjectiveIds,
              createdAt: new Date().toISOString(),
            },
            ...s.savedAudiences,
          ],
        })),
      deleteAudience: (id) =>
        set((s) => ({
          savedAudiences: s.savedAudiences.filter((a) => a.id !== id),
        })),
      loadAudience: (id) => {
        const a = get().savedAudiences.find((x) => x.id === id);
        if (!a) return;
        set({
          selectedPersonIds: a.personIds,
          selectedObjectiveIds: a.objectiveIds,
        });
      },

      recentResults: [],
      addRecentResult: (r) =>
        set((s) => ({
          recentResults: [
            r,
            ...s.recentResults.filter((x) => x.id !== r.id),
          ].slice(0, 10),
        })),

      recentlyViewedPersonIds: [],
      noteViewedPerson: (id) =>
        set((s) => ({
          recentlyViewedPersonIds: [
            id,
            ...s.recentlyViewedPersonIds.filter((x) => x !== id),
          ].slice(0, 8),
        })),

      results: {},
      storeResult: (r) =>
        set((s) => ({ results: { ...s.results, [r.id]: r } })),
      getResult: (id) => get().results[id],
      setResultFeedback: (id, feedback) =>
        set((s) => {
          const existing = s.results[id];
          if (!existing) return s;
          const next = { ...existing };
          if (feedback) next.feedback = feedback;
          else delete next.feedback;
          return { results: { ...s.results, [id]: next } };
        }),

      resultsDepth: 3,
      setResultsDepth: (d) => set({ resultsDepth: d }),

      propertiesPanelOpen: false,
      setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),

      customProfiles: {},
      saveProfile: (p) =>
        set((s) => ({ customProfiles: { ...s.customProfiles, [p.id]: p } })),
      deleteProfile: (id) =>
        set((s) => {
          const next = { ...s.customProfiles };
          delete next[id];
          return { customProfiles: next };
        }),

      saveCustomer: (c) =>
        set((s) => {
          // Convert the legacy Customer shape into a CustomerCompany and
          // write to the unified companies store. Callers (research server
          // action, customer-md round-trip) still produce Customer; the
          // shape conversion happens once, here.
          const company: Company = {
            id: c.id,
            kind: "customer",
            name: c.name,
            summary: c.summary,
            industry: c.industry,
            size: c.size,
            region: c.region,
            tags: c.tags,
            createdAt: c.createdAt,
            properties: {
              knownStakeholders: c.knownStakeholders,
              buyingTriggers: c.buyingTriggers,
              evaluationCriteria: c.evaluationCriteria,
              redFlags: c.redFlags,
              competitiveContext: c.competitiveContext,
              notes: c.notes,
              source: c.source,
              researchedAt: c.researchedAt,
            },
          };
          return { companies: { ...s.companies, [c.id]: company } };
        }),
      deleteCustomer: (id) =>
        set((s) => {
          const nextCompanies = { ...s.companies };
          delete nextCompanies[id];
          return { companies: nextCompanies };
        }),
      selectedCustomerId: undefined,
      setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

      // Seeded by the v2→v3 migration on first rehydrate. Fresh-install
      // users get the internal Company seeded via store-migrations using
      // a null-input run during onRehydrateStorage.
      companies: {},
      saveCompany: (c) =>
        set((s) => ({ companies: { ...s.companies, [c.id]: c } })),
      deleteCompany: (id) =>
        set((s) => {
          const next = { ...s.companies };
          delete next[id];
          return { companies: next };
        }),

      selectedResearchIds: [],
      toggleResearch: (id) =>
        set((s) => ({
          selectedResearchIds: s.selectedResearchIds.includes(id)
            ? s.selectedResearchIds.filter((x) => x !== id)
            : [...s.selectedResearchIds, id],
        })),
      clearSelectedResearch: () => set({ selectedResearchIds: [] }),

      businessUnits: {},
      saveBusinessUnit: (b) =>
        set((s) => ({
          businessUnits: { ...s.businessUnits, [b.id]: b },
        })),
      deleteBusinessUnit: (id) =>
        set((s) => {
          const nextBUs = { ...s.businessUnits };
          delete nextBUs[id];
          // OKRs that pointed at this BU lose the link
          const nextOkrs = { ...s.okrs };
          for (const okr of Object.values(nextOkrs)) {
            if (okr.businessUnitId === id) {
              nextOkrs[okr.id] = { ...okr, businessUnitId: undefined };
            }
          }
          return { businessUnits: nextBUs, okrs: nextOkrs };
        }),

      okrs: {},
      saveOKR: (o) => set((s) => ({ okrs: { ...s.okrs, [o.id]: o } })),
      deleteOKR: (id) =>
        set((s) => {
          const next = { ...s.okrs };
          delete next[id];
          return {
            okrs: next,
            selectedOKRIds: s.selectedOKRIds.filter((x) => x !== id),
          };
        }),
      selectedOKRIds: [],
      toggleOKR: (id) =>
        set((s) => ({
          selectedOKRIds: s.selectedOKRIds.includes(id)
            ? s.selectedOKRIds.filter((x) => x !== id)
            : [...s.selectedOKRIds, id],
        })),
      clearSelectedOKRs: () => set({ selectedOKRIds: [] }),

      metrics: {},
      replaceMetricsForDocument: (documentId, sourceKind, next) =>
        set((state) => {
          const remaining: Record<string, DerivedMetric> = {};
          for (const [id, m] of Object.entries(state.metrics)) {
            if (
              !(m.sourceKind === sourceKind && m.sourceDocumentId === documentId)
            ) {
              remaining[id] = m;
            }
          }
          for (const m of next) remaining[m.id] = m;
          return { metrics: remaining };
        }),
      deleteMetric: (id) =>
        set((state) => {
          const next = { ...state.metrics };
          delete next[id];
          return { metrics: next };
        }),

      buRecommendations: {},
      saveBURecommendations: (r) =>
        set((state) => ({
          buRecommendations: {
            ...state.buRecommendations,
            [r.businessUnitId]: r,
          },
        })),
      deleteBURecommendations: (businessUnitId) =>
        set((state) => {
          const next = { ...state.buRecommendations };
          delete next[businessUnitId];
          return { buRecommendations: next };
        }),

      documents: {},
      saveDocument: (d) =>
        set((state) => ({ documents: { ...state.documents, [d.id]: d } })),
      deleteDocument: (id) =>
        set((state) => {
          const next = { ...state.documents };
          delete next[id];
          // Drop metrics tied to this document so removing a research/PRD/
          // memo doesn't leave orphan rows on the BU dashboard.
          const remainingMetrics: Record<string, DerivedMetric> = {};
          for (const [mid, m] of Object.entries(state.metrics)) {
            if (m.sourceDocumentId !== id) remainingMetrics[mid] = m;
          }
          return {
            documents: next,
            metrics: remainingMetrics,
            selectedResearchIds: state.selectedResearchIds.filter(
              (x) => x !== id,
            ),
          };
        }),
    }),
    {
      name: "profiler-store-v3",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Strip render caches from the persisted snapshot. The microsite
      // `html` blob is regenerated deterministically from the outline by
      // lib/llm/synthesize-render.ts; persisting it bloats localStorage
      // toward the 5MB quota and slows every write. Keep the in-memory
      // copy intact — `partialize` only affects what gets serialized.
      partialize: (state) =>
        ({
          ...state,
          documents: Object.fromEntries(
            Object.entries(state.documents).map(([id, d]) =>
              d.kind === "microsite"
                ? [id, { ...d, properties: { ...d.properties, html: undefined } }]
                : [id, d],
            ),
          ),
        }) as typeof state,
      migrate: (persisted, fromVersion) => {
        // Chain the migrations forward. Each one is pure over its input
        // snapshot, so we can run them in sequence safely.
        try {
          let state = persisted;
          if (fromVersion < 2) state = migrateV1ToV2(state);
          if (fromVersion < 3) state = migrateV2ToV3(state);
          return state as Record<string, unknown>;
        } catch (err) {
          if (typeof console !== "undefined") {
            console.error("[profiler-store] migration failed:", err);
          }
        }
        return persisted as Record<string, unknown>;
      },
      onRehydrateStorage: () => (state) => {
        // First-time load: no persisted data means `migrate` never ran.
        // Seed the internal Company so /company/* surfaces have a target.
        if (!state) return;
        if (!state.companies?.["internal"]) {
          state.companies = {
            ...state.companies,
            internal: {
              id: "internal",
              kind: "internal",
              name: "ServiceNow",
              summary: "",
              tags: [],
              createdAt: new Date().toISOString(),
              properties: {},
            },
          };
        }
      },
    },
  ),
);
