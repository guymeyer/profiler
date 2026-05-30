import type {
  RecommendationResult,
  ArtifactType,
  Person,
  Objective,
  TacticalEdit,
  KeyRisk,
  PracticeQA,
  Customer,
  ResearchDocument,
  OKR,
  ResearchCitation,
  OKRAlignmentNote,
} from "@/lib/types";

export function buildMockRecommendation(args: {
  title: string;
  type: ArtifactType;
  rawContent: string;
  people: Person[];
  objectives: Objective[];
  hasArtifact: boolean;
  intent?: string;
  customer?: Customer;
  research?: ResearchDocument[];
  okrs?: OKR[];
}): RecommendationResult {
  const {
    title,
    type,
    rawContent,
    people,
    objectives,
    hasArtifact,
    intent,
    customer,
    research,
    okrs,
  } = args;
  if (people.length === 0) {
    return buildObjectiveOnlyMock({
      title,
      type,
      rawContent,
      objectives,
      hasArtifact,
      intent,
      customer,
      research,
      okrs,
    });
  }
  const multi = people.length > 1;
  const primary = people[0];
  const allDos = people.flatMap((p) => p.dos);
  const allDonts = people.flatMap((p) => p.donts);
  const allTriggers = people.flatMap((p) => p.decisionTriggers);

  // Heuristic fit score from coverage: + for matching dos in content,
  // - for matching donts. Bias to 50.
  let fit = 55;
  const content = rawContent.toLowerCase();
  const keyword = (s: string) => {
    const w = s.toLowerCase().split(/\W+/).find((x) => x.length > 5);
    return w ?? "";
  };
  if (hasArtifact && content.length > 0) {
    for (const d of allDos) {
      const k = keyword(d);
      if (k && content.includes(k)) fit += 2;
    }
    for (const d of allDonts) {
      const k = keyword(d);
      if (k && content.includes(k)) fit -= 3;
    }
    fit = Math.max(15, Math.min(85, fit));
  } else {
    fit = 50;
  }

  // Conflict detection across comm styles
  const styles = new Set(people.flatMap((p) => p.commStyle));
  const conflicts: string[] = [];
  if (styles.has("data-driven") && styles.has("narrative")) {
    conflicts.push(
      "Data-driven members (e.g. CFO, Data Science) and narrative members (e.g. CEO, CDO) will pull the framing in opposite directions.",
    );
  }
  if (styles.has("operational") && styles.has("narrative")) {
    conflicts.push(
      "Engineering wants failure modes named; CEO-style narrative leadership wants momentum framing. The deck needs both, in order.",
    );
  }

  const personFirstNames = people.map((p) => p.name.split(" ")[0]);
  const audienceLabel = multi
    ? `${personFirstNames.slice(0, -1).join(", ")} and ${
        personFirstNames[personFirstNames.length - 1]
      }`
    : primary.name;

  // Risks tied to specific people
  const keyRisks: KeyRisk[] = [];
  for (const p of people.slice(0, 3)) {
    keyRisks.push({
      risk: `${p.name.split(" ")[0]} will push back if the opening doesn't deliver ${shorten(
        p.decisionTriggers[0] ?? p.dos[0] ?? "their decision trigger",
      )}.`,
      severity: p.influence === "executive" ? "high" : "med",
      tiedTo: p.name,
    });
  }
  for (const o of objectives.slice(0, 1)) {
    keyRisks.push({
      risk: `Objective "${o.title}" is at risk: ${shorten(
        o.risks[0] ?? "the artifact doesn't address its risk pattern",
      )}.`,
      severity: "med",
      tiedTo: o.title,
    });
  }
  if (conflicts.length > 0) {
    keyRisks.push({
      risk: conflicts[0],
      severity: "high",
      tiedTo: "audience composition",
    });
  }

  if (customer && customer.redFlags?.length) {
    keyRisks.unshift({
      risk: `Customer-level red flag for ${customer.name}: ${shorten(customer.redFlags[0])}. Don't let the people-level recommendations override this — surface it on the first slide if it's load-bearing.`,
      severity: "high",
      tiedTo: customer.name,
    });
  }

  const recommendedFraming = hasArtifact
    ? `Open with the specific moment or signal that forced this work, framed in ${primary.commStyle[0]} terms. Name the decision being asked of ${audienceLabel} by the second beat — don't bury it. ${
        objectives.length > 0
          ? `Tie the opening to "${objectives[0].title}" explicitly so the strategic stakes are visible from sentence one.`
          : ""
      }`
    : `Build the readout around ${primary.commStyle[0]} cues for ${audienceLabel}. Lead with ${
        primary.decisionTriggers[0]?.toLowerCase() ?? "their primary trigger"
      }. Use the artifact analyzer to apply this strategy to a specific deck or memo.`;

  const tacticalEdits: TacticalEdit[] = hasArtifact
    ? buildMockEdits(rawContent, people, type)
    : [];

  const narrativeStructure = hasArtifact
    ? [
        `Open with the customer or operational signal — keep it specific, not abstract.`,
        `State the decision being asked of ${audienceLabel}.`,
        `Show the recommended direction with one ranked alternative.`,
        `Address the predictable objection from ${primary.name.split(" ")[0]} before they raise it.`,
        `Close with the ask and the next gate.`,
      ]
    : [
        `Pre-read sent 24h ahead with the decision stated up front.`,
        `Open the meeting with conviction, not status.`,
        `Walk the recommendation, then address the strongest counter-case.`,
        `Close with the explicit decision and named owner.`,
      ];

  const dos = uniq([
    ...allTriggers.slice(0, 3),
    ...(objectives.flatMap((o) => o.recommendedFraming).slice(0, 2)),
  ]).slice(0, 5);

  const donts = uniq(allDonts).slice(0, 5);

  const practiceQA = buildMockPracticeQA(rawContent, people, hasArtifact);

  const meetingApproach = multi
    ? `Send the pre-read 24 hours ahead — non-negotiable for ${personFirstNames
        .filter((n) => n)
        .slice(0, 2)
        .join(" and ")}. Open live with the headline conviction (60 seconds), then go straight to the decision. ${
        conflicts.length > 0
          ? `Be explicit about the framing tension: "${conflicts[0]}" — name it, pick the primary frame, and offer the alternative as a fallback.`
          : "Address the data-rigor and narrative pulls in that order — methodology first, momentum second."
      } Reserve the last five minutes for the dissent you expect, in writing afterward.`
    : undefined;

  const summary = hasArtifact
    ? `This ${labelForType(type)} reads at roughly ${fit}/100 fit for ${audienceLabel} as-is. ${
        fit < 50
          ? `The opening doesn't match ${primary.name.split(" ")[0]}'s decision trigger — that's the highest-leverage fix.`
          : fit > 80
            ? `The structure is largely on target; the win is in tightening the opening and naming the decision earlier.`
            : `The structure is workable but the framing is generic for this audience — replace the opening and tighten the ask.`
      } ${
        objectives.length > 0
          ? `Tie it explicitly to "${objectives[0].title}" to make the strategic stakes visible.`
          : ""
      }`
    : `Audience strategy for ${audienceLabel}: lead with ${primary.commStyle[0]} cues and a single sharp decision. ${
        multi
          ? "Multi-person — surface the framing conflict explicitly rather than averaging."
          : "Single audience — bend the opening directly to their decision trigger."
      }`;

  const intentTail = intent
    ? ` Anchor every move to your stated intent: "${shorten(intent, 100)}".`
    : "";
  const tldr = hasArtifact
    ? `Fit ${fit}/100 for ${audienceLabel}. ${
        fit < 50
          ? `Rewrite the opening to lead with ${primary.name.split(" ")[0]}'s decision trigger before anything else lands.`
          : fit > 80
            ? `Structure is solid — tighten the opening and name the decision earlier to push fit higher.`
            : `Replace the generic framing with ${primary.name.split(" ")[0]}'s decision trigger up front.`
      }${intentTail}`
    : `Build the readout around ${primary.commStyle[0]} cues for ${audienceLabel} and lead with one sharp decision.${intentTail}`;

  const audienceRead = multi
    ? `${personFirstNames.join(", ")} will each hear this through their own lens. ${primary.name.split(" ")[0]} will index on ${primary.commStyle[0]} cues; ${
        people[1]?.name.split(" ")[0] ?? "the next reviewer"
      } will index on ${people[1]?.commStyle[0] ?? "their own preferences"}. ${
        conflicts[0] ?? "Their preferences are compatible; the risk is depth not direction."
      }`
    : `${primary.name.split(" ")[0]} will read this looking for ${shorten(
        primary.decisionTriggers[0] ?? "their primary trigger",
      )}. Anything that doesn't serve that, they will skim.`;

  const revisedArtifact = hasArtifact
    ? buildRevisedArtifact(title, type, rawContent, people, objectives)
    : undefined;

  return {
    id: `rec_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    artifact: {
      title,
      type,
      rawContent: hasArtifact ? rawContent : undefined,
      intent: intent || undefined,
      customer: customer ? { id: customer.id, name: customer.name } : undefined,
      selectedPersonIds: people.map((p) => p.id),
      selectedObjectiveIds: objectives.map((o) => o.id),
    },
    tldr,
    summary,
    audienceRead,
    fitScore: fit,
    confidence: hasArtifact ? "medium" : "low",
    keyRisks: keyRisks.slice(0, 5),
    recommendedFraming,
    tacticalEdits,
    narrativeStructure,
    dos,
    donts,
    practiceQA,
    researchEvidence: buildMockResearchEvidence(research, primary),
    okrAlignment: buildMockOKRAlignment(okrs, primary),
    meetingApproach,
    revisedArtifact,
    generatedBy: "mock",
    createdAt: new Date().toISOString(),
  };
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function shorten(s: string, max = 90): string {
  const t = s.replace(/[.\s]+$/g, "").toLowerCase();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function labelForType(t: ArtifactType): string {
  return t.replace("-", " ");
}

function buildMockEdits(
  rawContent: string,
  people: Person[],
  type: ArtifactType,
): TacticalEdit[] {
  const lines = rawContent.split(/\n+/).filter((l) => l.trim().length > 0);
  const first = lines[0] ?? "";
  const primary = people[0];
  const edits: TacticalEdit[] = [];

  if (first) {
    edits.push({
      location: type === "slide-deck" ? "Slide 1 headline" : "Opening line",
      issue: `The opening doesn't match ${primary.name.split(" ")[0]}'s entry point. It reads as ${
        /update|status|progress/i.test(first) ? "a status update" : "a generic frame"
      } — they want to see the decision/customer signal first.`,
      before: first.length > 200 ? first.slice(0, 200) + "…" : first,
      after:
        primary.commStyle.includes("customer-centric")
          ? `One customer (or named segment) told us [specific signal]. We need to decide whether to [decision] by [date].`
          : primary.commStyle.includes("data-driven") ||
              primary.commStyle.includes("operational")
            ? `Top failure mode today: [specific failure]. Recommendation: [direction]. Confidence: [calibrated estimate].`
            : `Conviction: [one-sentence belief]. The decision we want today: [decision].`,
      rationale: `${primary.name.split(" ")[0]}'s decision trigger is "${shorten(
        primary.decisionTriggers[0] ?? "",
      )}". The opening has to serve that trigger directly.`,
    });
  }

  if (lines.length > 2) {
    const middle = lines[Math.floor(lines.length / 2)];
    edits.push({
      location: "Middle section",
      issue:
        "The supporting argument is presented neutrally — multiple options with equal weight. This reads as 'we haven't decided yet' to executive readers.",
      before: middle.length > 200 ? middle.slice(0, 200) + "…" : middle,
      after:
        "We recommend [direction] because [the one reason that matters]. The strongest alternative is [option]; we ruled it out because [specific tradeoff].",
      rationale:
        "Rank options. Survey-style presentations signal indecision to the seniors in this room.",
    });
  }

  if (people.some((p) => p.commStyle.includes("data-driven"))) {
    edits.push({
      location: "Any data claim",
      issue:
        "Numbers appear without sourcing, methodology, or confidence ranges.",
      after:
        "Every metric: source, time window, and either a confidence range or the underlying distribution. If you only have a point estimate, say so explicitly.",
      rationale:
        "The data-driven reviewer(s) will challenge any unsourced figure and lose trust within 30 seconds.",
    });
  }

  return edits.slice(0, 4);
}

function buildRevisedArtifact(
  title: string,
  type: ArtifactType,
  rawContent: string,
  people: Person[],
  objectives: Objective[],
): string {
  const primary = people[0];
  const obj = objectives[0];
  const audience = people.map((p) => p.name).join(", ");
  return `# ${title}

> Revised for: **${audience}**${obj ? ` · Objective: **${obj.title}**` : ""}

## The decision we need

State the single decision this readout exists to drive, in one sentence. Frame it as a fork: option A vs. option B vs. doing nothing.

## Why now

One paragraph: the specific signal — customer, operational, financial, or competitive — that forced this conversation. Be concrete. ${
    primary.commStyle.includes("customer-centric")
      ? "Lead with a verbatim quote from a named customer or segment."
      : primary.commStyle.includes("data-driven")
        ? "Lead with the specific number that changed, with source and window."
        : primary.commStyle.includes("operational")
          ? "Lead with the failure mode you've observed, with frequency and blast radius."
          : "Lead with the strategic shift that makes this the moment."
  }

## Recommendation

One paragraph: what we believe and why. Name the strongest counter-case in the next sentence and address it.

## Tradeoffs we accept

Bulleted list of the costs of this direction. Don't hide them.

## What we're asking for

A specific ask: decision, funding, capacity, or unblock. Name the owner and the timeframe.

${obj ? `## How this serves ${obj.title}\n\nTie the recommendation to one or two of the success criteria: ${obj.successCriteria
        .slice(0, 2)
        .map((s) => `*${s}*`)
        .join(", ")}. Be explicit.\n` : ""}
## Appendix

- Source data, methodology, and links.
- Alternatives considered, ranked.
- Open questions.

---
*This revised structure was generated from the original ${type.replace("-", " ")} (${rawContent.length} characters). Use it as a scaffold — keep the parts of your original that already match.*
`;
}

// Mock path for audiences defined by objective and/or customer only (no
// specific person). Useful for "external customer / unknown need" scenarios.
function buildObjectiveOnlyMock(args: {
  title: string;
  type: ArtifactType;
  rawContent: string;
  objectives: Objective[];
  hasArtifact: boolean;
  intent?: string;
  customer?: Customer;
  research?: ResearchDocument[];
  okrs?: OKR[];
}): RecommendationResult {
  const {
    title,
    type,
    rawContent,
    objectives,
    hasArtifact,
    intent,
    customer,
    research,
    okrs,
  } = args;
  const obj = objectives[0];
  const objLabel = objectives.length
    ? objectives.map((o) => o.title).join(", ")
    : customer
      ? "the customer's outcome"
      : "a general audience";
  const audienceLabel = customer
    ? customer.name
    : "an unknown / external audience";

  const intentSnippet = intent ? shorten(intent, 100) : null;

  const tldr = customer
    ? `Anchor the framing to ${customer.name}'s buying triggers${
        intent ? `, in service of: ${intentSnippet}` : ""
      }. Lead with their criteria, not your features.`
    : intent
      ? `Frame this around "${shorten(obj?.title ?? objLabel, 60)}" to land your intent: ${intentSnippet}.`
      : `Frame this around "${shorten(obj?.title ?? objLabel, 60)}" — make the objective the spine of every section.`;

  const summary = `${
    intent
      ? `Goal: ${intentSnippet}. `
      : ""
  }No specific people selected, so this strategy is built around ${
    objectives.length === 1 ? `the "${objLabel}" objective` : `the objectives ${objLabel}`
  }. The recommendations target a typical reader pursuing this outcome — be explicit about success criteria; assume skepticism by default.`;

  const audienceRead = `For ${audienceLabel}, lead with credibility: name the success criteria up front, show how this work hits them. Generic readers in pursuit of "${
    obj?.title ?? objLabel
  }" will skim past anything that doesn't directly serve that outcome.`;

  const keyRisks: KeyRisk[] = objectives.slice(0, 3).map((o) => ({
    risk: `Objective "${o.title}" is at risk: ${shorten(
      o.risks[0] ?? "common framing risk for this objective",
    )}.`,
    severity: "med" as const,
    tiedTo: o.title,
  }));

  if (customer?.redFlags?.length) {
    keyRisks.unshift({
      risk: `Red flag for ${customer.name}: ${shorten(customer.redFlags[0])}. Address it before the recommendation lands, or it will derail the conversation.`,
      severity: "high",
      tiedTo: customer.name,
    });
  }

  if (intent && !customer) {
    keyRisks.unshift({
      risk: `Your stated intent ("${intentSnippet}") is broad — without a named decision-maker, you can't tune the framing to their cues. Add one person to sharpen this.`,
      severity: "med",
      tiedTo: "audience",
    });
  }

  const recommendedFraming = `Open with the success criteria for "${
    obj?.title ?? objLabel
  }" and the specific signal that makes this work timely. ${
    intent ? `Anchor every section back to: "${intentSnippet}".` : ""
  } Avoid generic "here's our story" openings — readers in this mode want to know what you're asking and why now.`;

  const narrativeStructure = [
    `State the outcome you're pursuing: "${obj?.title ?? objLabel}".`,
    intent
      ? `Translate your intent into one specific ask the reader can act on.`
      : `Name the single decision or commitment you want from the reader.`,
    `Show how the work hits one or two success criteria — name them.`,
    `Acknowledge the strongest objection a skeptical reader would raise; rebut it.`,
    `Close with the next step and a timeframe.`,
  ];

  const dos = uniq([
    ...(customer?.buyingTriggers ?? []).slice(0, 2).map((t) => `Lead with: ${t}`),
    ...(customer?.evaluationCriteria ?? [])
      .slice(0, 2)
      .map((c) => `Address evaluation criterion: ${c}`),
    ...(obj?.recommendedFraming ?? []).slice(0, 2),
    ...(objectives.flatMap((o) => o.successCriteria.slice(0, 1))).slice(0, 1),
    intent ? `Tie every section back to: "${intentSnippet}".` : undefined,
  ].filter(Boolean) as string[]).slice(0, 6);

  const donts = uniq([
    ...(customer?.redFlags ?? []).slice(0, 2).map((r) => `Don't trigger: ${r}`),
    ...(obj?.risks ?? []).slice(0, 2),
    "Don't open with company background — start with the outcome.",
    "Don't list features without tying each to an evaluation criterion.",
  ]).slice(0, 6);

  return {
    id: `rec_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    artifact: {
      title,
      type,
      rawContent: hasArtifact ? rawContent : undefined,
      intent: intent || undefined,
      customer: customer ? { id: customer.id, name: customer.name } : undefined,
      selectedPersonIds: [],
      selectedObjectiveIds: objectives.map((o) => o.id),
    },
    tldr,
    summary,
    audienceRead,
    fitScore: hasArtifact ? 55 : 50,
    confidence: "low",
    keyRisks: keyRisks.slice(0, 4),
    recommendedFraming,
    tacticalEdits: [],
    narrativeStructure,
    dos,
    donts,
    practiceQA: buildObjectiveOnlyPracticeQA(objectives, customer, intent),
    researchEvidence: buildMockResearchEvidence(research),
    okrAlignment: buildMockOKRAlignment(okrs),
    meetingApproach: undefined,
    revisedArtifact: undefined,
    generatedBy: "mock",
    createdAt: new Date().toISOString(),
  };
}

// Build artifact-grounded practice Q&A for the people-based mock. We do crude
// signal extraction from the artifact (numbers, "we believe", "could") and tie
// each question to a probable asker by influence + comm style.
function buildMockPracticeQA(
  rawContent: string,
  people: Person[],
  hasArtifact: boolean,
): PracticeQA[] {
  const qa: PracticeQA[] = [];
  const primary = people[0];
  const dataPerson = people.find((p) => p.commStyle.includes("data-driven"));
  const opsPerson = people.find((p) => p.commStyle.includes("operational"));
  const narrPerson = people.find((p) => p.commStyle.includes("narrative"));

  if (hasArtifact) {
    // Pluck the first sourced number-looking thing
    const numMatch = rawContent.match(/(\$?\d[\d,.]+\s*%?)/);
    if (numMatch && dataPerson) {
      qa.push({
        question: `Where does the "${numMatch[1]}" figure come from — what's the source, time window, and confidence?`,
        askedBy: dataPerson.name,
        answer: `Bring the source, the window, and either a confidence range or the underlying distribution. If "${numMatch[1]}" is a point estimate, say so explicitly. ${dataPerson.name.split(" ")[0]} will not accept an unsourced number.`,
        severity: "high",
      });
    }

    if (/recommend|we believe|propose/i.test(rawContent)) {
      qa.push({
        question:
          "What's the strongest alternative you considered, and why did you rule it out?",
        askedBy: primary?.name,
        answer: `Name the strongest alternative explicitly and the specific tradeoff that killed it. Survey-style "we evaluated several options" answers will lose ${primary?.name.split(" ")[0] ?? "the room"}.`,
        severity: "high",
      });
    }

    if (opsPerson) {
      qa.push({
        question: `What's the rollback plan if this fails in week one?`,
        askedBy: opsPerson.name,
        answer: `State the failure mode you're guarding against, the canary criteria, and the rollback path in one sentence. ${opsPerson.name.split(" ")[0]} will keep asking until they hear it.`,
        severity: "high",
      });
    }

    if (narrPerson) {
      qa.push({
        question: `Who is the customer here — name one specifically, and what did they actually say?`,
        askedBy: narrPerson.name,
        answer: `Have one named customer or segment with a verbatim quote ready. Aggregate "user research showed" framings will get a "so what" from ${narrPerson.name.split(" ")[0]}.`,
        severity: "med",
      });
    }

    // Generic close
    qa.push({
      question: `What decision do you actually need from us today?`,
      askedBy: primary?.name,
      answer: `Lead with the answer up front: "We're asking you to [decision] by [date]." If you're not ready to ask, say so and ask for the next gate.`,
      severity: "med",
    });
  } else {
    qa.push(
      {
        question: `What changed since last quarter that makes this the right move now?`,
        askedBy: primary?.name,
        answer: `Name the specific signal (customer, operational, financial, competitive) that forced this conversation. "We've been thinking" answers will not land.`,
        severity: "high",
      },
      {
        question: `What does success look like at 90 days?`,
        askedBy: primary?.name,
        answer: `One metric, one date, one named owner. Multiple success criteria signals you haven't decided.`,
        severity: "high",
      },
      {
        question: `Who are we displacing or de-prioritizing to do this?`,
        askedBy: primary?.name,
        answer: `Name what gets cut. Refusing to name a tradeoff reads as wishful thinking.`,
        severity: "med",
      },
    );
  }

  // Cap and rank by severity
  const severityOrder: Record<PracticeQA["severity"], number> = {
    high: 0,
    med: 1,
    low: 2,
  };
  return qa.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 5);
}

function buildObjectiveOnlyPracticeQA(
  objectives: Objective[],
  customer?: Customer,
  intent?: string,
): PracticeQA[] {
  const qa: PracticeQA[] = [];
  const obj = objectives[0];
  const audienceLabel = customer?.name ?? "a typical reader";

  if (customer?.evaluationCriteria?.length) {
    qa.push({
      question: `How do we score against "${customer.evaluationCriteria[0]}" specifically?`,
      askedBy: customer.name,
      answer: `Have a one-line answer ready that maps directly to that criterion. Generic ROI talk won't substitute for criterion-by-criterion scoring.`,
      severity: "high",
    });
  }

  if (customer?.redFlags?.length) {
    qa.push({
      question: `What about ${shorten(customer.redFlags[0], 80)} — how is that addressed?`,
      askedBy: customer.name,
      answer: `Address it head-on, ideally on the first slide. Trying to defer this question lets it metastasize through the rest of the meeting.`,
      severity: "high",
    });
  }

  if (obj?.risks?.length) {
    qa.push({
      question: `How do you mitigate ${shorten(obj.risks[0], 80)}?`,
      askedBy: obj.title,
      answer: `Name the specific countermeasure with an owner. Risks without owners read as unowned.`,
      severity: "med",
    });
  }

  if (intent) {
    qa.push({
      question: `What does success look like for you here?`,
      askedBy: audienceLabel,
      answer: `Restate your intent ("${shorten(intent, 80)}") as the user-facing outcome the reader will get — not your internal goal.`,
      severity: "med",
    });
  }

  qa.push({
    question: `Why are you the right partner versus the incumbent?`,
    askedBy: audienceLabel,
    answer: `One sentence: the specific thing the incumbent can't or won't do. Vague "we're more agile" answers fail here.`,
    severity: "med",
  });

  return qa.slice(0, 5);
}

// Cite the first sentence of each research summary as a finding, pinned to
// the recommended framing. Crude but honest about the mock-mode trade-off.
function buildMockResearchEvidence(
  research?: ResearchDocument[],
  primary?: Person,
): ResearchCitation[] | undefined {
  if (!research || research.length === 0) return undefined;
  return research.slice(0, 4).map((r) => {
    const firstSentence =
      (r.summary || r.content).split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
    return {
      researchId: r.id,
      finding: shorten(firstSentence || r.title, 220),
      appliedTo: primary
        ? `recommendedFraming · supports leading with ${primary.name.split(" ")[0]}'s decision trigger`
        : "recommendedFraming",
    };
  });
}

// For each OKR, mock a "advances" claim that ties to the first KR. If the OKR
// status is "off-track", mark alignment as "tension" to surface the conflict.
function buildMockOKRAlignment(
  okrs?: OKR[],
  primary?: Person,
): OKRAlignmentNote[] | undefined {
  if (!okrs || okrs.length === 0) return undefined;
  return okrs.map((o) => {
    const kr = o.keyResults[0] ?? "the first Key Result";
    const tense = o.status === "off-track" ? "tension" : "advances";
    return {
      okrId: o.id,
      advancesHow:
        tense === "tension"
          ? `Heads up: this OKR is marked off-track, so leaning on it as motivation may invite scrutiny. Consider whether the framing actually helps move "${shorten(kr, 100)}".`
          : `Recommendation advances "${shorten(kr, 100)}"${primary ? ` by giving ${primary.name.split(" ")[0]} the framing they respond to` : ""}.`,
      alignment: tense as OKRAlignmentNote["alignment"],
    };
  });
}
