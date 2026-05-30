import type { Person } from "@/lib/types";
import type { SuggestExpertiseResult } from "@/lib/llm/suggest-expertise";

// Merge an LLM expertise suggestion into a person profile. Auto-suggested
// tags accumulate in the *Auto fields; existing tags (manual or prior auto)
// are never overwritten or removed. Returns the new Person or null if the
// suggestion adds nothing.

export function mergeExpertiseSuggestion(
  person: Person,
  suggestion: SuggestExpertiseResult,
): Person | null {
  const added =
    suggestion.addExpertiseAreas.length +
    suggestion.addActiveWork.length +
    suggestion.addInterests.length;
  if (added === 0) return null;

  return {
    ...person,
    expertiseAreasAuto: mergeUnique(
      person.expertiseAreasAuto,
      suggestion.addExpertiseAreas,
      person.expertiseAreas,
    ),
    activeWorkAuto: mergeUnique(
      person.activeWorkAuto,
      suggestion.addActiveWork,
      person.activeWork,
    ),
    interestsAuto: mergeUnique(
      person.interestsAuto,
      suggestion.addInterests,
      person.interests,
    ),
  };
}

function mergeUnique(
  existingAuto: string[] | undefined,
  added: string[],
  userSet: string[] | undefined,
): string[] {
  const userLower = new Set((userSet ?? []).map((s) => s.toLowerCase()));
  const out: string[] = [...(existingAuto ?? [])];
  const outLower = new Set(out.map((s) => s.toLowerCase()));
  for (const tag of added) {
    const lower = tag.toLowerCase();
    if (userLower.has(lower)) continue; // user already has it
    if (outLower.has(lower)) continue; // auto already has it
    out.push(tag);
    outLower.add(lower);
  }
  // Bound the auto list so it doesn't grow forever as more artifacts are
  // ingested. Keep the most recent N — newer suggestions reflect more
  // recent involvement.
  return out.slice(-20);
}
