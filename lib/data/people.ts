import type { Person } from "@/lib/types";

export const PEOPLE: Person[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    title: "Chief Product Officer",
    team: "Product",
    influence: "executive",
    commStyle: ["narrative", "customer-centric"],
    summary:
      "Wants concise narratives directly tied to customer needs. Allergic to vanity metrics.",
    reviewPreferences: [
      "Async pre-read at least 24 hours before any decision meeting.",
      "Opens with the customer problem, not the solution.",
      "Skims first; expect her to land on the headline + one chart.",
    ],
    visualPreferences: [
      "One chart per page maximum; prefers small multiples over dashboards.",
      "Customer quotes as pull quotes, not buried bullets.",
      "Sparse slides; she reads notes if she wants depth.",
    ],
    decisionTriggers: [
      "A specific customer story tied to a measurable outcome.",
      "A clear next decision the meeting will make (not 'discuss').",
      "Explicit tradeoffs called out, not hidden under 'we will balance...'.",
    ],
    objections: [
      "Will challenge any number that isn't sourced.",
      "Pushes back hard on 'engagement' as a success metric.",
      "Skeptical of solutions presented before the problem is sized.",
    ],
    dos: [
      "Lead with a single named customer or segment.",
      "Name the decision you want by the third slide / paragraph.",
      "Tie every metric to a customer behavior, not a product event.",
    ],
    donts: [
      "Don't open with team accomplishments or roadmap status.",
      "Don't say 'engagement is up' — say what the customer did differently.",
      "Don't bring multiple solutions without ranking them.",
    ],
    exampleGuidance: [
      "If you're showing adoption data, pair it with a verbatim customer quote from a real interview. Numbers without voice will get a 'so what?' from Maya.",
      "When proposing a roadmap change, lead with the customer signal that forced the change, not the team's analysis. The analysis is the appendix.",
      "She will reject any deck that opens with a status update. Restructure so the first slide is the customer question you're trying to answer.",
    ],
    tags: ["product", "customer-voice", "executive", "narrative"],
  },
  {
    id: "daniel-ortiz",
    name: "Daniel Ortiz",
    title: "VP Engineering",
    team: "Engineering",
    influence: "executive",
    commStyle: ["operational", "data-driven", "technical"],
    summary:
      "Responds to realistic operational scenarios that expose risk and user friction. Hates over-polished decks.",
    reviewPreferences: [
      "Wants the failure modes named on slide one.",
      "Prefers a working doc over a deck whenever possible.",
      "Reads end-to-end before the meeting; will ask the deepest question first.",
    ],
    visualPreferences: [
      "Architecture diagrams welcome; corporate stock illustrations actively distrusted.",
      "Tables over charts when comparing options.",
      "Will mute when he sees an SVG funnel.",
    ],
    decisionTriggers: [
      "An honest assessment of what's most likely to break.",
      "Clear ownership: which team carries the pager.",
      "A reversible-vs-irreversible call on the decision.",
    ],
    objections: [
      "Distrusts any plan without a named failure scenario.",
      "Calls out unstated capacity assumptions.",
      "Will block on 'we'll figure out scaling later' framing.",
    ],
    dos: [
      "Open with the top risk and your mitigation.",
      "Name the on-call team and the SLO impact.",
      "Show the unhappy path, then the happy path.",
    ],
    donts: [
      "Don't oversell. Confidence without nuance reads as inexperience.",
      "Don't hide migration cost in a footnote.",
      "Don't use 'simply' or 'just' in any technical sentence.",
    ],
    exampleGuidance: [
      "If you bring a launch plan, bring a rollback plan on the same page. A launch plan without rollback gets a 'come back when this is real'.",
      "When you cite a metric, cite the dashboard URL or query. Numbers without a source are decorative to Daniel.",
      "Frame the proposal as 'here's what's most likely to go wrong, here's how we'd know, here's what we'd do' — in that order.",
    ],
    tags: ["engineering", "operational", "risk-first", "executive"],
  },
  {
    id: "priya-iyer",
    name: "Priya Iyer",
    title: "Chief Executive Officer",
    team: "Executive",
    influence: "executive",
    commStyle: ["narrative", "visual"],
    summary:
      "Prefers optimistic executive-level data visualization that shows momentum and confidence.",
    reviewPreferences: [
      "5-minute attention window. Lead with the headline and the ask.",
      "Pre-reads optional; she'll engage live if the opening lands.",
      "Asks 'what does this enable?' more than 'what does this do?'",
    ],
    visualPreferences: [
      "Trend lines going up and to the right; emphasize the slope.",
      "Big, bold numbers. Subtitled context.",
      "One color of emphasis per slide; everything else neutral.",
    ],
    decisionTriggers: [
      "A credible momentum story across two or three timeframes.",
      "Conviction in the team's tempo, not just the plan.",
      "A clear strategic bet that's named as a bet.",
    ],
    objections: [
      "Allergic to hedging language ('we may', 'consider', 'could').",
      "Will reject decks that read like status updates.",
      "Suspicious of plans that ask permission instead of stating direction.",
    ],
    dos: [
      "State your conviction in the first sentence.",
      "Show momentum across quarters, not just last month.",
      "Frame the ask as a bet with named upside.",
    ],
    donts: [
      "Don't list risks before the headline opportunity.",
      "Don't ask 'what do you think?' — propose, then invite challenge.",
      "Don't use neutral tones in the headline chart.",
    ],
    exampleGuidance: [
      "When showing growth, never use a 30-day window. Show 6 quarters minimum. Priya's mental model operates in years.",
      "Open every readout with a one-line conviction: 'We believe X, and here's why now is the moment.' If you can't write that line, the deck isn't ready.",
      "Risks belong on slide three at the earliest, framed as 'what we're betting against' — not as a list of fears.",
    ],
    tags: ["ceo", "executive", "momentum", "conviction"],
  },
  {
    id: "marcus-webb",
    name: "Marcus Webb",
    title: "Chief Financial Officer",
    team: "Finance",
    influence: "executive",
    commStyle: ["data-driven"],
    summary:
      "Wants ROI, sensitivity, and multi-year horizon. Suspicious of soft claims and unsourced figures.",
    reviewPreferences: [
      "Will print the deck and write on it. Bring the numbers in a usable form.",
      "Expects a one-page financial summary, every time.",
      "Reads the appendix.",
    ],
    visualPreferences: [
      "Tables, not infographics. Aligned decimals.",
      "Sensitivity ranges shown, not just point estimates.",
      "Footnotes for every assumption.",
    ],
    decisionTriggers: [
      "A defensible ROI with named sensitivities.",
      "A clear funding ask with phasing and gates.",
      "Comparison to a 'do nothing' baseline.",
    ],
    objections: [
      "Rejects any cost number without a methodology note.",
      "Pushes on 'productivity gains' if you can't show how they convert to dollars or hours.",
      "Will not approve plans without an explicit downside case.",
    ],
    dos: [
      "Lead with the financial summary in a table.",
      "Show base / upside / downside cases.",
      "Tie every benefit to a measurable financial proxy.",
    ],
    donts: [
      "Don't use 'industry benchmark' without a citation.",
      "Don't pitch a multi-year plan without a phasing gate.",
      "Don't present softer benefits before the financial picture.",
    ],
    exampleGuidance: [
      "Every funding ask Marcus sees should fit on one page: cost, benefit, payback, sensitivity, gates. If it doesn't fit, the plan is unclear.",
      "When you claim 'productivity savings', show the FTE math. He doesn't believe hours-saved numbers unless they map to budget lines.",
      "If you only have a point estimate, say so. He respects calibrated uncertainty more than false precision.",
    ],
    tags: ["finance", "roi", "executive", "rigor"],
  },
  {
    id: "lena-park",
    name: "Lena Park",
    title: "Chief Design Officer",
    team: "Design",
    influence: "executive",
    commStyle: ["narrative", "visual"],
    summary:
      "Story arc first, craft signals matter. Will reject inconsistent visual hierarchy.",
    reviewPreferences: [
      "Reads decks like screenplays — looks for the arc.",
      "Wants the strategic frame before any screen is shown.",
      "Will pause on the first inconsistent treatment and not move on.",
    ],
    visualPreferences: [
      "Consistent type scale and spacing throughout. Inconsistency reads as carelessness.",
      "Real product UI over wireframes when possible.",
      "Annotations placed with intent, not floating.",
    ],
    decisionTriggers: [
      "A clear user journey with named emotional beats.",
      "Evidence of craft — every detail considered.",
      "A point of view, not a survey of options.",
    ],
    objections: [
      "Distrusts decks that show three concepts without ranking them.",
      "Calls out brand or accessibility violations immediately.",
      "Skeptical of research summarized without verbatim quotes or clips.",
    ],
    dos: [
      "Open with the journey. Show where the user is, where they're going, what blocks them.",
      "Have a recommended direction. Survey the alternatives as supporting context.",
      "Bring craft to the deck itself — it's a sample of your work.",
    ],
    donts: [
      "Don't show three competing concepts with equal weight.",
      "Don't reduce qualitative research to a percentage.",
      "Don't use placeholder Lorem in screens she'll see.",
    ],
    exampleGuidance: [
      "Structure design reviews as a narrative: 'User is here. They want to go there. This is what stops them. Here's our take, and here's why it's the take.' Three concepts presented neutrally signal that you don't have a point of view yet.",
      "When you bring research, bring at least one verbatim user quote per major insight. Stats without voice get dismissed as 'survey science'.",
      "Treat your deck as a deliverable, not a vehicle. The craft of the deck tells Lena how much craft is in the product.",
    ],
    tags: ["design", "craft", "narrative", "executive"],
  },
  {
    id: "aaron-goldstein",
    name: "Aaron Goldstein",
    title: "VP Sales",
    team: "Go-to-market",
    influence: "executive",
    commStyle: ["customer-centric", "narrative"],
    summary:
      "Customer logos, deal-impact stories, and enablement asks named explicitly.",
    reviewPreferences: [
      "Wants the deal-impact framing in the first 60 seconds.",
      "Cares about what reps will actually say in a customer meeting.",
      "Will skip the technical detail unless it changes the pitch.",
    ],
    visualPreferences: [
      "Logo wall for proof points. Real deal sizes, not ranges.",
      "Pricing tables when relevant; flat hierarchies otherwise.",
      "Battle-card formats land well.",
    ],
    decisionTriggers: [
      "A named deal or set of deals this unblocks.",
      "A clear enablement ask: what reps need to learn, by when.",
      "Competitive positioning that names the competitor explicitly.",
    ],
    objections: [
      "Pushes back on feature-led pitches with no customer signal.",
      "Won't sign on to a plan without enablement timing.",
      "Skeptical of 'we'll co-sell with...' without a partner contact.",
    ],
    dos: [
      "Open with a named deal or named segment.",
      "State the rep enablement plan with dates and owners.",
      "Use the customer's language, not the product team's.",
    ],
    donts: [
      "Don't lead with the feature; lead with the customer pain.",
      "Don't promise launch dates without sales-ready timing.",
      "Don't bury the competitive angle in the appendix.",
    ],
    exampleGuidance: [
      "Every new capability pitch should answer: which 3 named deals does this unblock, and what is the rep supposed to say next Monday? If you can't answer both, the pitch is incomplete.",
      "Aaron measures launches by sales readiness, not GA date. Show 'sales-ready' as a separate milestone, two weeks before GA.",
      "When you mention a competitor, name them and show the head-to-head. Vague 'category leader' framing reads as dodging.",
    ],
    tags: ["sales", "gtm", "customer-stories", "executive"],
  },
  {
    id: "sofia-reyes",
    name: "Sofia Reyes",
    title: "Head of Data Science",
    team: "Data",
    influence: "senior",
    commStyle: ["data-driven", "technical"],
    summary:
      "Methodology rigor first. Calls out unstated assumptions; prefers technical appendices.",
    reviewPreferences: [
      "Reads the methodology section before the conclusion.",
      "Wants a confidence interval on every effect size.",
      "Asks for the SQL or notebook when something looks too clean.",
    ],
    visualPreferences: [
      "Honest axes (no truncated y-axis tricks).",
      "Distribution plots over means.",
      "Annotated charts; standalone charts get questioned.",
    ],
    decisionTriggers: [
      "Methodology that survives scrutiny.",
      "Unknowns named, not hidden.",
      "A pre-registered success criterion, ideally.",
    ],
    objections: [
      "Will challenge any aggregate without showing the underlying distribution.",
      "Calls out p-hacking patterns or selective windowing.",
      "Distrusts qualitative claims dressed up as quantitative.",
    ],
    dos: [
      "Show the distribution, not just the mean.",
      "Pre-register your success metric in the doc itself.",
      "Name your confounders before she does.",
    ],
    donts: [
      "Don't cherry-pick a 7-day window without showing the rolling trend.",
      "Don't say 'statistically significant' without an effect size.",
      "Don't bury the methodology in an appendix you didn't write.",
    ],
    exampleGuidance: [
      "Lead any data narrative with: 'Here's the question, here's the data, here's the method, here's what could be wrong with it.' Then the result. Reversing this order erodes Sofia's trust within 30 seconds.",
      "When showing an A/B test, include a power analysis and a pre-registered metric. Post-hoc metric selection is the fastest way to lose her support.",
      "Always show the unhealthy distribution alongside the healthy one. Means hide everything she cares about.",
    ],
    tags: ["data", "rigor", "methodology", "senior"],
  },
  {
    id: "jordan-kim",
    name: "Jordan Kim",
    title: "VP Marketing",
    team: "Marketing",
    influence: "executive",
    commStyle: ["narrative", "customer-centric", "visual"],
    summary:
      "Narrative + positioning. Segments audiences sharply; brand-consistency hawk.",
    reviewPreferences: [
      "Wants the positioning statement up front: who is this for, why now, why us.",
      "Reads the headline and the call to action; everything else is supporting.",
      "Looks for audience segmentation in every plan.",
    ],
    visualPreferences: [
      "On-brand type, color, and imagery. Off-brand work is a tell.",
      "Hero treatments over dense info graphics.",
      "Customer testimonials as primary visual elements.",
    ],
    decisionTriggers: [
      "A sharp, ownable positioning angle.",
      "Audience segments with sized addressable counts.",
      "A measurable comms outcome (awareness, consideration, conversion).",
    ],
    objections: [
      "Rejects 'for everyone' positioning instantly.",
      "Pushes back on launches without a narrative beat in the broader story.",
      "Skeptical of channel plans that don't name a primary audience.",
    ],
    dos: [
      "State the audience and the wedge in one sentence.",
      "Show how this beat connects to the year's narrative.",
      "Bring measurable comms goals, not just activity counts.",
    ],
    donts: [
      "Don't say 'broad market'. Pick a wedge.",
      "Don't ship a launch plan that's only a checklist.",
      "Don't go off-brand in any executive-facing artifact.",
    ],
    exampleGuidance: [
      "Every launch should answer: who is this for, what shift in their mind are we trying to cause, and what's the one thing they should walk away saying? If the third answer is generic, the positioning isn't sharp enough.",
      "Tie every campaign to the company's annual narrative arc. Standalone launches that don't reinforce the arc dilute the brand.",
      "Distinguish 'we'll do X activities' from 'this will shift the audience here'. Activity plans without outcome shifts won't get sign-off.",
    ],
    tags: ["marketing", "positioning", "narrative", "executive"],
  },
];

export function getPerson(id: string) {
  return PEOPLE.find((p) => p.id === id);
}

export function getPeople(ids: string[]) {
  return ids.map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean) as Person[];
}
