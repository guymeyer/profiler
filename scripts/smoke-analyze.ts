import { buildMockRecommendation } from "../lib/llm/mock";
import { PEOPLE } from "../lib/data/people";
import { OBJECTIVES } from "../lib/data/objectives";

const people = ["maya-chen", "marcus-webb", "priya-iyer"]
  .map((id) => PEOPLE.find((p) => p.id === id))
  .filter((x): x is (typeof PEOPLE)[number] => Boolean(x));
const objectives = ["align-leadership", "secure-funding"]
  .map((id) => OBJECTIVES.find((o) => o.id === id))
  .filter((x): x is (typeof OBJECTIVES)[number] => Boolean(x));

const r = buildMockRecommendation({
  title: "Q3 Mobile Strategy Memo",
  type: "strategy-memo",
  rawContent:
    "Summary\nWe've made great progress on mobile this year. Engagement is up. We want to discuss next steps for Q3.\n\nOptions\nWe're considering several directions. Each has tradeoffs.",
  people,
  objectives,
  hasArtifact: true,
});

console.log("generatedBy:", r.generatedBy);
console.log("fitScore:", r.fitScore);
console.log("confidence:", r.confidence);
console.log("\nsummary:\n", r.summary);
console.log("\naudienceRead:\n", r.audienceRead);
console.log("\nkeyRisks:");
for (const k of r.keyRisks)
  console.log(" -", k.severity, ":", k.risk, k.tiedTo ? `(tied to ${k.tiedTo})` : "");
console.log("\nedits count:", r.tacticalEdits.length);
console.log("first edit location:", r.tacticalEdits[0]?.location);
console.log("first edit before:", r.tacticalEdits[0]?.before?.slice(0, 80));
console.log("first edit after:", r.tacticalEdits[0]?.after?.slice(0, 120));
console.log("\nmeetingApproach present:", !!r.meetingApproach);
console.log("meetingApproach preview:", r.meetingApproach?.slice(0, 200));
console.log("\nrevisedArtifact lines:", r.revisedArtifact?.split("\n").length);
