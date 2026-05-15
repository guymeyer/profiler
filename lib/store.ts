"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  RecommendationResult,
  ResultFeedback,
  Person,
  Customer,
  ResearchArtifact,
  BusinessUnit,
  OKR,
} from "@/lib/types";

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

  // Editable people overlay (override seed by id; new custom people too)
  customProfiles: Record<string, Person>;
  saveProfile: (p: Person) => void;
  deleteProfile: (id: string) => void;

  // Customers
  customers: Record<string, Customer>;
  saveCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  selectedCustomerId?: string;
  setSelectedCustomerId: (id: string | undefined) => void;

  // Research
  research: Record<string, ResearchArtifact>;
  saveResearch: (r: ResearchArtifact) => void;
  deleteResearch: (id: string) => void;
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

      customProfiles: {},
      saveProfile: (p) =>
        set((s) => ({ customProfiles: { ...s.customProfiles, [p.id]: p } })),
      deleteProfile: (id) =>
        set((s) => {
          const next = { ...s.customProfiles };
          delete next[id];
          return { customProfiles: next };
        }),

      customers: {},
      saveCustomer: (c) =>
        set((s) => ({ customers: { ...s.customers, [c.id]: c } })),
      deleteCustomer: (id) =>
        set((s) => {
          const next = { ...s.customers };
          delete next[id];
          return { customers: next };
        }),
      selectedCustomerId: undefined,
      setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

      research: {},
      saveResearch: (r) =>
        set((s) => ({ research: { ...s.research, [r.id]: r } })),
      deleteResearch: (id) =>
        set((s) => {
          const next = { ...s.research };
          delete next[id];
          return {
            research: next,
            selectedResearchIds: s.selectedResearchIds.filter((x) => x !== id),
          };
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
    }),
    {
      name: "profiler-store-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
