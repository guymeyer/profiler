import type { Objective } from "@/lib/types";

export const OBJECTIVES: Objective[] = [
  {
    id: "increase-adoption",
    title: "Increase adoption",
    description:
      "Drive more users to start using a capability, deepen activation, and reduce drop-off in the early experience.",
    successCriteria: [
      "Activation rate among new users in the first 14 days.",
      "Reduction in drop-off at the named friction step.",
      "Increase in repeat-usage cohorts week over week.",
    ],
    risks: [
      "Inflating top-of-funnel without retained behavior.",
      "Optimizing for the wrong activation event.",
      "Adoption framed without a defined target segment.",
    ],
    recommendedFraming: [
      "Lead with the friction step you're removing, not the feature you're shipping.",
      "Name the segment whose adoption you're moving — not 'all users'.",
      "Show the cohort curve, not the cumulative count.",
    ],
    tags: ["growth", "activation", "user-behavior"],
  },
  {
    id: "reduce-risk",
    title: "Reduce risk",
    description:
      "Lower the probability or impact of a known operational, financial, or reputational risk.",
    successCriteria: [
      "Reduction in incident frequency or severity.",
      "Coverage of named failure modes by mitigations.",
      "Time-to-detect or time-to-recover improvement.",
    ],
    risks: [
      "Risk-reduction theater: process without measurable change.",
      "Hiding the residual risk after mitigation.",
      "Framing reduction without naming the baseline.",
    ],
    recommendedFraming: [
      "Open with the specific failure mode and its current cost.",
      "Show before / after for the named risk metric.",
      "Be explicit about residual risk; don't claim 'eliminated'.",
    ],
    tags: ["risk", "operational", "trust"],
  },
  {
    id: "improve-customer-confidence",
    title: "Improve customer confidence",
    description:
      "Strengthen customer trust in the product through reliability, predictability, and communication.",
    successCriteria: [
      "Reduction in trust-related support volume.",
      "Improvement in trust-linked NPS or CSAT items.",
      "Renewal or expansion rate among at-risk accounts.",
    ],
    risks: [
      "Equating satisfaction with trust.",
      "Improving the metric without changing the experience.",
      "Confidence framing applied to a quality problem you haven't fixed.",
    ],
    recommendedFraming: [
      "Anchor on a specific moment in the customer journey where trust breaks.",
      "Show the customer's words about why they don't trust the product today.",
      "Tie comms changes to product changes; comms alone won't move it.",
    ],
    tags: ["customer", "trust", "retention"],
  },
  {
    id: "align-leadership",
    title: "Align leadership",
    description:
      "Get the executive team to a shared mental model and committed direction on a decision.",
    successCriteria: [
      "Explicit decision recorded in writing.",
      "Named owners with timeframes.",
      "Dissent surfaced and resolved, not avoided.",
    ],
    risks: [
      "False consensus driven by meeting dynamics, not agreement.",
      "Decisions vague enough that everyone projects their own version.",
      "Alignment artifact that doesn't survive contact with the org.",
    ],
    recommendedFraming: [
      "Frame the decision as a fork: option A vs. option B vs. doing nothing.",
      "State the recommendation and the strongest counter-case.",
      "End every readout with the explicit decision and owner.",
    ],
    tags: ["leadership", "decisions", "executive"],
  },
  {
    id: "secure-funding",
    title: "Secure funding",
    description:
      "Win approval for budget, headcount, or capital allocation for a defined initiative.",
    successCriteria: [
      "Funding approved at the requested level.",
      "Phasing gates accepted, not contested.",
      "Sponsor named at the decision level.",
    ],
    risks: [
      "Asking before establishing credibility on a smaller bet.",
      "Inflated benefits paired with vague costs.",
      "No phasing — making it harder to say yes than to defer.",
    ],
    recommendedFraming: [
      "Open with the financial summary, not the strategy preamble.",
      "Show base, upside, and downside cases.",
      "Offer phased funding with explicit gates that make it easy to say yes.",
    ],
    tags: ["finance", "funding", "executive"],
  },
  {
    id: "speed-up-execution",
    title: "Speed up execution",
    description:
      "Reduce cycle time and friction so the team ships and learns faster.",
    successCriteria: [
      "Reduction in cycle time from idea to ship.",
      "Increase in shipped experiments per month.",
      "Decrease in handoff cost between teams.",
    ],
    risks: [
      "Speed framed without naming what's being deprioritized.",
      "Confusing throughput with progress.",
      "Speed wins that erode quality the team will pay for later.",
    ],
    recommendedFraming: [
      "Name what you'll stop doing or do less of.",
      "Show cycle-time distribution, not just averages.",
      "Tie speed gains to a learning rate, not just shipping velocity.",
    ],
    tags: ["execution", "operational", "team"],
  },
  {
    id: "validate-design-direction",
    title: "Validate design direction",
    description:
      "Confirm a chosen design direction is the right one — or correct it before more investment.",
    successCriteria: [
      "Direction confirmed or revised with named evidence.",
      "Specific design risks closed or escalated.",
      "Next gate defined: what will trigger broader investment.",
    ],
    risks: [
      "Validating a direction with users who don't represent the buyer.",
      "Treating preference as evidence.",
      "Calling it 'validated' when only the easiest parts were tested.",
    ],
    recommendedFraming: [
      "Lead with the specific risks the work needs to retire.",
      "Show what would change your mind if the data went the other way.",
      "Name the next gate explicitly: what proof would justify scaling investment.",
    ],
    tags: ["design", "research", "validation"],
  },
];

export function getObjective(id: string) {
  return OBJECTIVES.find((o) => o.id === id);
}

export function getObjectives(ids: string[]) {
  return ids
    .map((id) => OBJECTIVES.find((o) => o.id === id))
    .filter(Boolean) as Objective[];
}
