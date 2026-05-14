"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecommendationResult } from "@/lib/types";

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
  togglePerson: (id: string) => void;
  toggleObjective: (id: string) => void;
  setSelection: (sel: Partial<AudienceSelection>) => void;
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
}

export const useProfilerStore = create<ProfilerStore>()(
  persist(
    (set, get) => ({
      selectedPersonIds: [],
      selectedObjectiveIds: [],
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
        set({ selectedPersonIds: [], selectedObjectiveIds: [] }),

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
    }),
    {
      name: "profiler-store-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
