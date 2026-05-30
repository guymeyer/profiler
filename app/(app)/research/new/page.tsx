import { redirect } from "next/navigation";

// /research/new is the legacy entry point. The classifier-based intake at
// /knowledge/new handles every kind; passing ?kind=research bypasses
// classification since we already know the answer. PR 3 of the post-
// refactor consolidation.
export default function LegacyResearchIntakePage() {
  redirect("/knowledge/new?kind=research");
}
