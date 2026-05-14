import type { ArtifactType } from "@/lib/types";

export interface SampleArtifact {
  label: string;
  title: string;
  type: ArtifactType;
  rawContent: string;
}

export const SAMPLE_ARTIFACTS: SampleArtifact[] = [
  {
    label: "Strategy memo",
    title: "Q3 Mobile Strategy Memo (sample)",
    type: "strategy-memo",
    rawContent: `Q3 Mobile Strategy Memo
Author: Product Team
Status: Draft

Summary
We've made great progress on mobile this year. Engagement is up across the board and our team has shipped a number of features. We want to discuss next steps for Q3 and align on the roadmap. There are a few options we could pursue and we'd like to gather input from the leadership team.

Background
Mobile usage has continued to grow. Users are engaging more with the app. We see opportunities to invest further in this area.

Options
We're considering several directions for Q3:
- Option A: Continue investing in existing features and polish.
- Option B: Build a new mobile-only capability.
- Option C: Expand to a new platform.

Each option has tradeoffs. We're seeking guidance on which direction to pursue.

Next steps
Discuss at the next leadership review. We'll come back with a more detailed plan after we hear from the group.
`,
  },
  {
    label: "Design narrative",
    title: "Onboarding Redesign Direction (sample)",
    type: "design-narrative",
    rawContent: `Onboarding Redesign — Direction Proposal

Context
The current onboarding flow has been in production for 18 months. We tested three new concepts with users over the past sprint.

Research
We ran 12 usability sessions. 60% of users preferred concept B. The findings were mixed across concepts.

Concepts
Concept A: A minimalist approach focused on a single primary action.
Concept B: A guided tour with progressive disclosure.
Concept C: A workspace-style setup with smart defaults.

Our recommendation
We are considering moving forward with Concept B based on user preference.

Next steps
We'd like to discuss timing and resourcing with the team.
`,
  },
  {
    label: "Funding request",
    title: "Platform Reliability Funding Request (sample)",
    type: "product-brief",
    rawContent: `Platform Reliability Funding Request

Summary
We need additional investment in our platform reliability initiative. The team has been making good progress but we need more resources to hit our targets.

The ask
We are requesting funding for 6 additional engineers and a dedicated SRE lead. Total estimated cost is in the range of industry benchmarks for similar initiatives.

Why now
Reliability is critical to our customers. We've seen increased pressure from enterprise accounts and we want to get ahead of any issues.

Productivity benefits
This investment will generate significant productivity gains across the engineering org by reducing time spent on incidents and improving developer experience.

Outcomes
We expect improved customer satisfaction, fewer incidents, and stronger trust with our enterprise customers.

Phasing
We'd start hiring in Q3 and ramp through Q4. By Q1 of next year we'd be fully operational.
`,
  },
];
