import type {
  RecommendationResult,
  ArtifactType,
  Person,
  Objective,
  TacticalEdit,
  KeyRisk,
} from "@/lib/types";

export function buildMockRecommendation(args: {
  title: string;
  type: ArtifactType;
  rawContent: string;
  people: Person[];
  objectives: Objective[];
  hasArtifact: boolean;
}): RecommendationResult {
  const { title, type, rawContent, people, objectives, hasArtifact } = args;
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

  const emphasize = uniq([
    ...allTriggers.slice(0, 3),
    ...(objectives.flatMap((o) => o.recommendedFraming).slice(0, 2)),
  ]).slice(0, 5);

  const avoid = uniq(allDonts).slice(0, 5);

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
      selectedPersonIds: people.map((p) => p.id),
      selectedObjectiveIds: objectives.map((o) => o.id),
    },
    summary,
    audienceRead,
    fitScore: fit,
    confidence: hasArtifact ? "medium" : "low",
    keyRisks: keyRisks.slice(0, 5),
    recommendedFraming,
    tacticalEdits,
    narrativeStructure,
    emphasize,
    avoid,
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
