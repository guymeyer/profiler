import {
  SYNTHESIS_LENSES,
  type Person,
  type PersonLensSection,
  type ResearchArtifact,
  type SynthesisLens,
  type SynthesisLensSection,
  type SynthesisOutline,
} from "@/lib/types";

// Deterministic mock outline for when ANTHROPIC_API_KEY isn't set.
// Real generation produces richer, ranked content; this exists so the demo
// and smoke paths never break.

interface MockInput {
  title?: string;
  research: ResearchArtifact[];
  prds?: import("@/lib/types").PRD[];
  people?: Person[];
  modifier?: string;
}

export function buildMockSynthesisOutline(
  input: MockInput,
): SynthesisOutline {
  const { research } = input;
  const lensSections = Object.fromEntries(
    SYNTHESIS_LENSES.map((l) => [l.id, buildLensSection(l, research)]),
  ) as SynthesisOutline["lenses"];

  const people: PersonLensSection[] = (input.people ?? []).map((p) =>
    buildPersonLensSection(p, research),
  );

  return {
    title:
      input.title?.trim() ||
      `Multi-lens read of ${research.length} research report${
        research.length === 1 ? "" : "s"
      }`,
    overview:
      `This synthesis re-reads ${research.length} research report${
        research.length === 1 ? "" : "s"
      } as a single corpus. The general lens below presents the through-line of the evidence without per-function bias. Switch lenses to see what each organization — Product Design, Product Management, Engineering, Research, Marketing & Comms, Sales & Customer Success, and Executive Leadership — should take away from the same body of evidence.` +
      ((input.prds?.length ?? 0) > 0
        ? ` ${input.prds!.length} PRD${input.prds!.length === 1 ? "" : "s"} also included as planned intent — read where intent and observation align vs. diverge.`
        : "") +
      (people.length > 0
        ? ` ${people.length} person lens${people.length === 1 ? "" : "es"} also available — microscopic reframes for the specific named stakeholders below.`
        : "") +
      (input.modifier
        ? `\n\nThis read was regenerated with the modifier: "${input.modifier}".`
        : ""),
    lenses: lensSections,
    people: people.length > 0 ? people : undefined,
    sources: research.map((r) => ({
      title: r.title,
      summary: r.summary || r.content.slice(0, 220),
    })),
  };
}

function buildPersonLensSection(
  p: Person,
  research: ResearchArtifact[],
): PersonLensSection {
  const firstName = p.name.split(" ")[0];
  const titles = research.map((r) => r.title);
  const firstCite = titles[0] ? `(cf. "${titles[0]}")` : "";

  const fullBrief: SynthesisLensSection = {
    summary: `${p.name} (${p.title}) reads this corpus through ${
      p.commStyle?.[0] ?? "their"
    } communication preferences. ${p.summary}`,
    hmwQuestions: [
      `How might we frame the strongest finding in the way ${firstName} prefers to receive information ${firstCite}?`,
      `How might we anticipate the objection ${firstName} is most likely to raise against the recommended direction?`,
      `How might we use ${firstName}'s decision triggers to accelerate alignment on the next move?`,
    ],
    insights: research.slice(0, Math.min(research.length, 3)).map((r) => ({
      headline: `${firstName}'s read of "${r.title}"`,
      body: `Filtered through ${firstName}'s preferences (${p.commStyle?.join(", ") ?? "n/a"}), the most relevant takeaway is: ${r.summary || r.content.slice(0, 220)}`,
      citations: [r.title],
    })),
    implications: [
      `Lead with ${firstName}'s decision triggers, not with methodology.`,
      `Name the predictable objection (${p.objections?.[0] ?? "ask their team"}) up-front, then disarm it.`,
      `Match cadence to ${firstName}'s reviewing style — ${p.reviewPreferences?.[0] ?? "concise written brief"}.`,
    ],
    tensions: [
      `${firstName}'s do's and don'ts may conflict with how the team currently presents this research — surface the conflict before the meeting, not in it.`,
    ],
    next: [
      `Send ${firstName} a one-page pre-read shaped to their preferences before any larger forum.`,
      `Identify the one decision ${firstName} can make this quarter that unlocks the most for the team.`,
    ],
  };

  const exec: PersonLensSection["executiveSummary"] = {
    tldr: `${firstName}: ${research.length} report${research.length === 1 ? "" : "s"} point to a decision you can make this quarter. The cost of waiting is higher than the cost of being wrong.`,
    keyPoints: [
      `Strongest signal: ${research[0]?.summary ?? "see corpus"}`,
      `Predictable objection to disarm: ${p.objections?.[0] ?? "ask their team"}`,
      `What ${firstName} should do: take the meeting and name the call.`,
    ],
    callToAction: `Make the call ${firstName} alone can make — the one that changes the team's trajectory for the quarter.`,
  };

  return {
    personId: p.id,
    personName: p.name,
    fullBrief,
    executiveSummary: exec,
  };
}

function buildLensSection(
  lens: SynthesisLens,
  research: ResearchArtifact[],
): SynthesisLensSection {
  const titles = research.map((r) => r.title);
  return {
    summary:
      lens.id === "general"
        ? `Read across ${research.length} report${research.length === 1 ? "" : "s"}, this corpus points to a small number of through-lines. The general lens surfaces what is well-supported and what would change behavior this quarter — without favoring any single function.`
        : `${lens.brief} The same evidence reframed for ${lens.name}: each insight below points to a decision someone in this org should make.`,
    hmwQuestions: defaultHmwQuestions(lens, titles),
    insights: research.slice(0, Math.min(research.length, 4)).map((r) => ({
      headline:
        lens.id === "general"
          ? `Signal from "${r.title}"`
          : `${lens.name} read of "${r.title}"`,
      body: r.summary || r.content.slice(0, 240),
      citations: [r.title],
    })),
    implications: defaultImplications(lens, titles),
    tensions:
      research.length > 1
        ? [
            `Reports vary in methodology and recency — treat the most recent as the working hypothesis where they disagree.`,
            `Where two reports converge, the implication hardens. Where they diverge, the tension is the signal.`,
          ]
        : [
            `Single-report corpus — implications are directional, not validated. The next study should attempt to falsify, not confirm.`,
          ],
    next: defaultNext(lens),
  };
}

function defaultHmwQuestions(
  lens: SynthesisLens,
  titles: string[],
): string[] {
  const cite = titles[0] ? ` (cf. "${titles[0]}")` : "";
  switch (lens.id) {
    case "general":
      return [
        `How might we test the strongest through-line of this corpus within four weeks${cite}?`,
        `How might we make the weakest evidence in this corpus harder to ignore?`,
        `How might we put a named owner on every implication this corpus implies?`,
      ];
    case "product-design":
      return [
        `How might we redesign the moment of friction most often named in this corpus${cite}?`,
        `How might we make the mental model the research reveals visible in the product itself?`,
        `How might we close the gap between design intuition and what the corpus actually shows?`,
        `How might we make the smallest design change that would change observed user behavior?`,
      ];
    case "product-management":
      return [
        `How might we re-rank the next quarter against the unmet needs surfaced here${cite}?`,
        `How might we identify the single feature to kill based on this corpus?`,
        `How might we instrument the metric that would tell us this synthesis was right or wrong?`,
        `How might we segment users so the implications stop averaging out?`,
      ];
    case "engineering":
      return [
        `How might we close the largest user pain with the smallest engineering investment${cite}?`,
        `How might we expose the capability gap the corpus most often runs into?`,
        `How might we reduce the reliability or performance issue this corpus surfaces?`,
      ];
    case "research":
      return [
        `How might we falsify the strongest insight in this corpus${cite}?`,
        `How might we replicate the thinnest claim before anyone acts on it?`,
        `How might we design the next study so it answers a decision, not a curiosity?`,
      ];
    case "marketing":
      return [
        `How might we lift the customer language in this corpus directly into messaging${cite}?`,
        `How might we make the narrative this evidence earns unmistakable in our positioning?`,
        `How might we retire claims this corpus no longer supports?`,
      ];
    case "sales-cs":
      return [
        `How might we change the deal-stage playbook for the friction this corpus names${cite}?`,
        `How might we surface the expansion path this corpus reveals to CSMs in flow?`,
        `How might we get ahead of the churn signal the corpus exposes?`,
      ];
    case "executive":
      return [
        `How might we compress this corpus to the single decision only leadership can make${cite}?`,
        `How might we escalate the risk this evidence most directly implicates?`,
        `How might we sponsor the experiment that would validate the strongest insight?`,
      ];
  }
}

function defaultImplications(lens: SynthesisLens, titles: string[]): string[] {
  const cite = titles[0] ? ` (see "${titles[0]}")` : "";
  switch (lens.id) {
    case "general":
      return [
        `Treat the strongest through-line as the working hypothesis for the quarter${cite}.`,
        `Name an owner for each implication below — unowned ones rot.`,
        `Validate the weakest evidence first, not the strongest.`,
      ];
    case "product-design":
      return [
        `Re-examine the current design intuition where it conflicts with the corpus.`,
        `Convert each insight above into a design problem with a measurable success state.`,
        `Identify the smallest design change that would change observed user behavior${cite}.`,
      ];
    case "product-management":
      return [
        `Re-rank the roadmap against the unmet needs surfaced above.`,
        `Identify one thing to kill and one thing to build based on this corpus.`,
        `Define the metric that will tell you the corpus was right or wrong.`,
      ];
    case "engineering":
      return [
        `Map each insight to the platform capability that would address it.`,
        `Identify the smallest engineering investment that closes the largest user pain.`,
        `Name the reliability or performance gap most visible in the corpus${cite}.`,
      ];
    case "research":
      return [
        `Grade the evidence strength of each insight above.`,
        `Identify which claims need replication and which are over-supported.`,
        `Draft the next study that would resolve the largest open question.`,
      ];
    case "marketing":
      return [
        `Name the narrative this evidence earns — and the one it does not.`,
        `Identify positioning claims that hold up under this corpus, and those that don't.`,
        `Find the customer language worth lifting into the messaging directly${cite}.`,
      ];
    case "sales-cs":
      return [
        `Map each insight to the deal stage it shows up in.`,
        `Identify expansion paths the corpus reveals.`,
        `Name the churn risks the corpus implies, and which playbook addresses each.`,
      ];
    case "executive":
      return [
        `Compress the corpus to the smallest set of decisions only you can make.`,
        `Name the one risk to objectives this evidence most directly implicates.`,
        `Identify what to escalate and what to delegate this quarter.`,
      ];
  }
}

function defaultNext(lens: SynthesisLens): string[] {
  switch (lens.id) {
    case "general":
      return [
        `Pick the single insight that, if true, changes what ships next quarter. Validate or falsify within four weeks.`,
        `Assign owners to every implication. Unowned implications die.`,
        `Schedule a 30-minute corpus review with cross-functional leads.`,
      ];
    case "product-design":
      return [
        `Sketch the design that would prove the strongest insight wrong.`,
        `Run a 5-person concept test on the highest-priority finding within two weeks.`,
      ];
    case "product-management":
      return [
        `Bring the re-ranked roadmap to the next review with this corpus attached as evidence.`,
        `Define the success metric tied to the strongest insight, and instrument it.`,
      ];
    case "engineering":
      return [
        `Draft the architecture review for the capability gap most visible above.`,
        `Estimate the smallest investment that closes the largest user pain.`,
      ];
    case "research":
      return [
        `Draft the next study that would falsify the strongest insight.`,
        `File the gaps as backlog items with a decision each would unlock.`,
      ];
    case "marketing":
      return [
        `Test two narratives backed by this corpus with a target audience.`,
        `Refresh messaging assets where customer language has shifted.`,
      ];
    case "sales-cs":
      return [
        `Update the playbook for the deal stage the corpus most affects.`,
        `Brief CSMs on the churn signal the corpus exposes.`,
      ];
    case "executive":
      return [
        `Make the single decision the corpus most directly implies.`,
        `Sponsor the experiment that would validate the strongest insight.`,
      ];
  }
}
