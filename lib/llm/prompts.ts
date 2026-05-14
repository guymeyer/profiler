import type { Person, Objective, Artifact } from "@/lib/types";

export const SYSTEM_PROMPT = `You are a senior chief of staff and design strategist embedded in an enterprise. You give blunt, specific, politically-aware guidance about how to present work to specific people, leadership groups, and business objectives.

Operating rules — these are non-negotiable:

1. Be specific. Never write "make it clearer" or "consider X" without showing the concrete fix. Every recommendation must be actionable today.
2. Ground everything in the supplied profiles. Do NOT invent facts about people. If a profile doesn't address something, say what you'd need to know.
3. When you suggest a rewrite, provide actual prose, not descriptions of prose. Show before/after when the artifact contains prose worth rewriting.
4. Tie every risk to the specific audience member or objective it relates to. Generic risks are not useful.
5. Have a point of view. Rank options. If you flag something as missing, name what should go there.
6. Match tone to audience seniority. Executive audiences want conviction; technical audiences want precision; design audiences want craft.
7. No hedging. Banned phrases: "you may want to", "consider", "perhaps", "it might be worth", "potentially". Either recommend it or don't.
8. If the audience has conflicting preferences, name the conflict and pick a primary frame. Don't try to please everyone.
9. fitScore is a calibrated estimate 0–100 of how well the artifact, as-is, will land with this audience. Justify it in the summary if it's below 50 or above 85.

Output shape: you will call the submit_recommendation tool with structured fields. Do not output prose outside the tool call.`;

export function serializePerson(p: Person): string {
  return `## ${p.name} — ${p.title} (${p.team})
Influence: ${p.influence}
Communication style: ${p.commStyle.join(", ")}
Summary: ${p.summary}

Communication preferences:
${p.reviewPreferences.map((x) => `- ${x}`).join("\n")}

Presentation preferences:
${p.visualPreferences.map((x) => `- ${x}`).join("\n")}

Decision triggers:
${p.decisionTriggers.map((x) => `- ${x}`).join("\n")}

Predictable objections:
${p.objections.map((x) => `- ${x}`).join("\n")}

Do's:
${p.dos.map((x) => `- ${x}`).join("\n")}

Don'ts:
${p.donts.map((x) => `- ${x}`).join("\n")}

Example guidance:
${p.exampleGuidance.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;
}

export function serializeObjective(o: Objective): string {
  return `## ${o.title}
${o.description}

Success criteria:
${o.successCriteria.map((x) => `- ${x}`).join("\n")}

Common risks:
${o.risks.map((x) => `- ${x}`).join("\n")}

Recommended framing:
${o.recommendedFraming.map((x) => `- ${x}`).join("\n")}`;
}

export function buildAudienceBlock(
  people: Person[],
  objectives: Objective[],
): string {
  const peopleBlock = people.length
    ? `# Selected audience — people\n\n${people.map(serializePerson).join("\n\n---\n\n")}`
    : "";
  const objBlock = objectives.length
    ? `# Selected audience — objectives\n\n${objectives.map(serializeObjective).join("\n\n---\n\n")}`
    : "";
  return [peopleBlock, objBlock].filter(Boolean).join("\n\n");
}

export function buildArtifactBlock(artifact: {
  title: string;
  type: string;
  rawContent: string;
}): string {
  return `# Artifact to analyze

Title: ${artifact.title}
Type: ${artifact.type}

--- BEGIN ARTIFACT CONTENT ---
${artifact.rawContent}
--- END ARTIFACT CONTENT ---`;
}

export function buildTaskInstruction(opts: {
  hasArtifact: boolean;
  multiPerson: boolean;
}): string {
  const sections: string[] = [];
  if (opts.hasArtifact) {
    sections.push(
      "Analyze the artifact above against the selected audience. Produce a structured recommendation.",
    );
    sections.push(
      "Include at least one before/after rewrite if the artifact contains prose worth rewriting. Reference specific locations in the artifact (paragraph numbers, slide numbers, section headings) so the user can find them.",
    );
    sections.push(
      "Include a revisedArtifact field containing a revised version of the artifact reflecting your recommendations. Keep it tight — section-level rewrites are fine; do not pad.",
    );
  } else {
    sections.push(
      "There is no artifact yet. Produce an audience strategy for this group: how to frame work for them in general, the meeting/readout approach, the narrative structure to use, what to emphasize, what to avoid.",
    );
    sections.push("Leave revisedArtifact empty.");
  }
  if (opts.multiPerson) {
    sections.push(
      "This is a multi-person audience. Surface shared preferences and conflicting expectations explicitly. Include a meetingApproach describing how to run the readout.",
    );
  } else {
    sections.push("Single-person audience. Leave meetingApproach empty.");
  }
  return sections.join("\n\n");
}
