import type {
  Person,
  Objective,
  Artifact,
  Customer,
  ResearchDocument,
  OKR,
  BusinessUnit,
} from "@/lib/types";

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
10. The tldr is a 1–2 line takeaway — the single most important move, in plain language, no hedging. Treat it as the one sentence that survives if the user reads nothing else.
11. The dos and donts arrays form a specific Do's and Don'ts outline. Each entry is one imperative sentence and references a named person, objection, or section when relevant. No generic advice like "be clear" or "avoid jargon". A reader should be able to act on each line without re-reading the rest of the output.
12. practiceQA is the artifact-grounded rehearsal kit. Each question must be specific to THIS artifact — quote a number, claim, or section the questioner would press on. Don't recycle generic objections from profiles. Each answer must be concrete; if the right answer requires data the artifact doesn't supply, say what data to bring. Tie each question to the named person or role most likely to ask it. Order by severity, sharpest first.
13. When research artifacts are attached, you MUST cite them in researchEvidence. Quote or paraphrase the specific finding — don't summarize the whole study. Pin each citation to where in the recommendation it applies. Internal research is the user's strongest lever against pushback; treat it as primary evidence, not flavor.
14. When OKRs are attached, you MUST produce okrAlignment for each one. State precisely which Key Result(s) this recommendation moves and how. If the recommendation conflicts with an OKR, say so (alignment: "tension") — don't fabricate alignment. If it's neutral, label it neutral. Honesty here is the user's lever — fake alignment will be sniffed out and devalue the whole tool.

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

export function serializeCustomer(c: Customer): string {
  const lines: string[] = [];
  lines.push(`## ${c.name}`);
  const meta = [c.industry, c.size, c.region].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);
  if (c.summary) {
    lines.push("");
    lines.push(c.summary);
  }
  pushBlock(lines, "Known stakeholders", c.knownStakeholders);
  pushBlock(lines, "Buying triggers", c.buyingTriggers);
  pushBlock(lines, "Evaluation criteria", c.evaluationCriteria);
  pushBlock(lines, "Red flags", c.redFlags);
  pushBlock(lines, "Competitive context", c.competitiveContext);
  pushBlock(lines, "Notes", c.notes);
  return lines.join("\n");
}

function pushBlock(out: string[], heading: string, items: string[]) {
  if (!items?.length) return;
  out.push("");
  out.push(`${heading}:`);
  for (const item of items) out.push(`- ${item}`);
}

export function serializeResearch(r: ResearchDocument): string {
  const lines: string[] = [];
  lines.push(`## ${r.title}`);
  lines.push(`Id: ${r.id}`);
  lines.push(`Source: ${r.source ?? "Internal"}`);
  if (r.properties.conductedAt)
    lines.push(`Conducted: ${r.properties.conductedAt}`);
  if (r.properties.methodology)
    lines.push(`Methodology: ${r.properties.methodology}`);
  if (r.properties.participants.length > 0) {
    lines.push(`Participants: ${r.properties.participants.join("; ")}`);
  }
  if (r.summary) {
    lines.push("");
    lines.push(`Summary: ${r.summary}`);
  }
  lines.push("");
  lines.push("Body:");
  // Cap body to keep prompts reasonable; truncate gently.
  lines.push(r.content.length > 8000 ? r.content.slice(0, 8000) + "\n…[truncated]" : r.content);
  return lines.join("\n");
}

export function serializeOKR(o: OKR, bus: Record<string, BusinessUnit>): string {
  const buName = o.businessUnitId ? bus[o.businessUnitId]?.name : undefined;
  const lines: string[] = [];
  lines.push(`## ${o.objective}`);
  lines.push(`Id: ${o.id}`);
  lines.push(
    `Level: ${o.level === "company" ? "Company" : `BU — ${buName ?? "unknown"}`}`,
  );
  lines.push(`Timeframe: ${o.timeframe}`);
  if (o.status) lines.push(`Status: ${o.status}`);
  lines.push("");
  lines.push("Key Results:");
  o.keyResults.forEach((kr, i) => lines.push(`KR${i + 1}. ${kr}`));
  if (o.notes) {
    lines.push("");
    lines.push(`Notes: ${o.notes}`);
  }
  return lines.join("\n");
}

export function buildAudienceBlock(
  people: Person[],
  objectives: Objective[],
  customer?: Customer,
  research: ResearchDocument[] = [],
  okrs: OKR[] = [],
  bus: Record<string, BusinessUnit> = {},
): string {
  const peopleBlock = people.length
    ? `# Selected audience — people\n\n${people.map(serializePerson).join("\n\n---\n\n")}`
    : "";
  const objBlock = objectives.length
    ? `# Selected audience — objectives\n\n${objectives.map(serializeObjective).join("\n\n---\n\n")}`
    : "";
  const customerBlock = customer
    ? `# Customer context\n\n${serializeCustomer(customer)}`
    : "";
  const researchBlock = research.length
    ? `# Research evidence — cite specifically by id\n\n${research.map(serializeResearch).join("\n\n---\n\n")}`
    : "";
  const okrBlock = okrs.length
    ? `# Strategic OKRs — align the recommendation explicitly\n\n${okrs.map((o) => serializeOKR(o, bus)).join("\n\n---\n\n")}`
    : "";
  return [peopleBlock, objBlock, customerBlock, researchBlock, okrBlock]
    .filter(Boolean)
    .join("\n\n");
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
  hasPeople?: boolean;
  hasCustomer?: boolean;
  hasResearch?: boolean;
  hasOKRs?: boolean;
  intent?: string;
}): string {
  const sections: string[] = [];

  if (opts.intent) {
    sections.push(
      `# User's stated intent\n\n${opts.intent}\n\nTreat this as the goal the recommendation must serve. Every Do, Don't, and framing decision should advance this intent. If the intent conflicts with what the audience's profiles would normally prefer, name the conflict and pick a side — don't average.`,
    );
  }

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

  if (opts.hasPeople === false) {
    sections.push(
      "No specific people were selected — only objectives and/or a customer. Treat the audience as unknown / external (e.g. a prospect, a new stakeholder, a generic enterprise reviewer). Build recommendations around the selected objectives, the customer context (if present), and the user's intent. audienceRead should describe how a typical reader at this customer (or pursuing these objectives) will receive the work. Tie risks to objectives or to the customer's red flags, not to named people.",
    );
  }

  if (opts.hasCustomer) {
    sections.push(
      "A customer profile is attached. Use it as ground truth for buying triggers, evaluation criteria, and red flags. When a customer-level risk or trigger contradicts a person-level preference, name the conflict explicitly — don't smooth it over. Where the customer has known stakeholders by role (e.g. 'CFO'), refer to them by role unless a specific named person is also selected.",
    );
  }

  if (opts.hasResearch) {
    sections.push(
      "Research artifacts are attached as primary-source evidence. Anchor specific Do's, Don'ts, risks, and framing decisions to specific findings via researchEvidence. Quote the source rather than paraphrasing in summary terms. The user will share this output with stakeholders — citations are the lever that makes the recommendation hard to dismiss.",
    );
  }

  if (opts.hasOKRs) {
    sections.push(
      "Strategic OKRs are attached. Produce okrAlignment for every OKR id supplied. State which Key Result(s) the recommendation moves and how. If a recommendation creates tension with an OKR, surface it explicitly (alignment: 'tension') rather than papering over the conflict.",
    );
  }

  if (opts.multiPerson) {
    sections.push(
      "This is a multi-person audience. Surface shared preferences and conflicting expectations explicitly. Include a meetingApproach describing how to run the readout.",
    );
  } else if (opts.hasPeople !== false) {
    sections.push("Single-person audience. Leave meetingApproach empty.");
  }

  return sections.join("\n\n");
}
