import type { Person } from "@/lib/types";

// Mock profile data for the prototype, modeled around ServiceNow's executive
// leadership and a few senior leaders who report into them. Names + public
// titles are sourced from servicenow.com/company/leadership.html, theorg.com,
// and LinkedIn (current as of May 2026). The *behavioral* content — decision
// triggers, do's/don'ts, objections, example guidance — is deliberately
// role-archetype based: it describes what any leader in this function at a
// public enterprise software company would typically weigh, not claims about
// how these specific individuals operate in private. Treat this entire array
// as prototype demo data and replace with your own profiles before using the
// tool in anger.

export const PEOPLE: Person[] = [
  {
    id: "bill-mcdermott",
    name: "Bill McDermott",
    title: "Chairman, President & CEO",
    team: "Office of the CEO",
    influence: "executive",
    commStyle: ["narrative", "customer-centric"],
    summary:
      "Sales-led storyteller. Opens with customer outcomes and platform momentum, closes with the bigger market opportunity. Allergic to internal jargon and feature-list pitches.",
    reviewPreferences: [
      "Pre-read landed at least a day ahead; expect the headline to do the work.",
      "Wants the customer name and outcome on slide one, not buried in an appendix.",
      "If you're asking for a decision, the ask is in the first 60 seconds.",
    ],
    visualPreferences: [
      "Customer logos and named accounts on the opening slide.",
      "One bold claim per slide; supporting numbers in a footer, not the headline.",
      "Story arc: customer → ServiceNow workflow → outcome → market expansion.",
    ],
    decisionTriggers: [
      "Named customer wins with measurable outcomes (TCV, time-to-value, displacement).",
      "Clear tie to platform expansion — Now Platform, AI Agents, cross-workflow plays.",
      "Partnership leverage — hyperscalers, SI ecosystem, advisory firms.",
      "Market-creation story, not market-share story.",
    ],
    objections: [
      "Anything that starts with internal status updates instead of customer voice.",
      "Roadmap items without a customer attached.",
      "Defensive framings — he wants offense.",
    ],
    dos: [
      "Open with the customer story, named and specific.",
      "Tie every feature back to a workflow that customers buy.",
      "State the market opportunity in dollar terms and timeframe.",
      "Show partnership leverage explicitly.",
    ],
    donts: [
      "Don't lead with engineering investment without the customer pull.",
      "Don't bury the ask under risk mitigation.",
      "Don't dwell on competitor weaknesses — own the ground we want.",
    ],
    exampleGuidance: [
      "When proposing a new AI Agents capability, open with a customer who would buy it — by name — and the workflow it transforms. The platform discussion is the appendix.",
      "If you're presenting a roadmap, frame each item as 'this is the customer outcome it enables', not 'this is the engineering effort it requires'.",
      "Any deck that opens with internal team accomplishments will get redirected. Lead with the customer signal that forced the work in the first place.",
    ],
    tags: [
      "executive",
      "ceo",
      "customer-led",
      "narrative",
      "now-platform",
      "servicenow",
    ],
  },
  {
    id: "gina-mastantuono",
    name: "Gina Mastantuono",
    title: "President & CFO (also leads Corporate Strategy & Development)",
    team: "Finance, Strategy & Corporate Development",
    influence: "executive",
    commStyle: ["data-driven", "operational"],
    summary:
      "Numbers leader. Wants ARR, FCF, operating margin, and CAC payback math on the table — sourced, defensible, peer-benchmarked. Also runs corporate strategy and M&A (Moveworks, Armis acquisitions in 2025). Skeptical of growth stories that don't carry their own economics.",
    reviewPreferences: [
      "Bring a one-page financial summary as the pre-read; the deck is for discussion.",
      "Source every metric: window, methodology, who computed it.",
      "Show the unit economics, not just the top-line.",
    ],
    visualPreferences: [
      "Tables over charts when precision matters. Charts with confidence bands when forecasting.",
      "Peer benchmarks where available — public-comp ARR growth, FCF margin, R&D as % of revenue.",
      "Sensitivities explicit: what if growth comes in 200bps light?",
    ],
    decisionTriggers: [
      "Defensible ARR trajectory with margin discipline — growth and efficiency, not one or the other.",
      "Sourced numbers a board member would accept on first pass.",
      "Clear CAC payback and net retention story.",
      "M&A theses tied to specific revenue synergy or platform extension, not vague strategic value.",
      "Risk-adjusted scenarios with downside named.",
    ],
    objections: [
      "Unsourced metrics or peer comparisons that don't disclose methodology.",
      "Growth investments without operating-leverage path.",
      "Hand-wavy ROI cases that won't survive a board review.",
    ],
    dos: [
      "Open with the financial frame: ARR impact, margin impact, FCF impact.",
      "Bring at least one public-comp benchmark when claiming category leadership.",
      "Show the operating-leverage path, not just the top-line.",
      "Be explicit about the downside — name the scenario where it doesn't work.",
    ],
    donts: [
      "Don't cite a metric you can't immediately source.",
      "Don't propose investment without a payback window.",
      "Don't separate growth and efficiency — she expects both in one frame.",
    ],
    exampleGuidance: [
      "If you're proposing a new product investment, the financial summary slide carries: ARR uplift, gross margin impact, R&D ratio shift, and CAC payback at 90/180 days. Anything less and the meeting becomes about producing that.",
      "When citing customer wins, attach the dollar value and the displacement (what they stopped paying for). Logos without dollar context aren't persuasive at her level.",
      "She'll ask 'what's the downside scenario?' early — have a slide ready with the 70th-percentile bear case and the action plan if you land there.",
    ],
    tags: [
      "executive",
      "cfo",
      "data-driven",
      "finance",
      "strategy",
      "m-and-a",
      "servicenow",
    ],
  },
  {
    id: "amit-zavery",
    name: "Amit Zavery",
    title: "President, Chief Product Officer & Chief Operating Officer",
    team: "Product, Engineering, Cloud Infrastructure & UX",
    influence: "executive",
    commStyle: ["data-driven", "technical", "narrative"],
    summary:
      "Platform thinker. Frames everything through Now Platform extensibility, AI Agents, and developer/builder velocity. Wants product decisions tied to the data architecture and the ecosystem flywheel — not single-feature wins. Combined CPO+COO scope as of late 2024.",
    reviewPreferences: [
      "Pre-read with the platform diagram, not the feature spec.",
      "Show the data flow and the integration surface, not just the UI.",
      "Where does this fit in the AI Agents architecture? Answer that on slide one.",
    ],
    visualPreferences: [
      "Architecture diagrams that show data flow, control flow, and trust boundaries.",
      "Developer/builder metrics — time-to-build, time-to-deploy, ecosystem reach.",
      "Workflow composability evidence: this thing plus that thing equals N new outcomes.",
    ],
    decisionTriggers: [
      "Clear platform fit — extends Now Platform primitives rather than living alongside.",
      "AI Agents integration story — agentic workflows, tool use, evals.",
      "Developer/builder leverage — how many partners or customers can build on this.",
      "Data architecture story — how the data graph evolves to enable this.",
    ],
    objections: [
      "Point solutions disconnected from the platform.",
      "Features without a clear extension surface for builders.",
      "AI capabilities pitched in isolation from agent orchestration.",
      "Data silos masquerading as product launches.",
    ],
    dos: [
      "Lead with how this extends the platform, not what it does standalone.",
      "Show the AI Agents tie-in: what tools, what workflows, what trust model.",
      "Quantify builder/developer impact: time saved, ecosystem leverage.",
      "Map the data flow end-to-end before you talk about the UI.",
    ],
    donts: [
      "Don't pitch a feature as if customers buy features — they buy workflows.",
      "Don't treat AI as a bolt-on layer — argue agent-native or argue why not.",
      "Don't ignore the data architecture; it determines what's actually possible later.",
    ],
    exampleGuidance: [
      "When proposing a new capability, the second slide is 'how this composes with the rest of the platform'. If you can't draw that diagram, the proposal isn't ready.",
      "If your feature touches AI, lead with the agent architecture: which agent owns this, what tools does it call, how do humans stay in the loop, what does an eval look like. Anything less and he'll ask the questions live.",
      "Builder metrics matter as much as customer metrics — 'this lets partners ship a workflow in two weeks instead of two months' is a much stronger story than raw user counts.",
    ],
    tags: [
      "executive",
      "cpo",
      "coo",
      "platform",
      "ai-agents",
      "now-platform",
      "developers",
      "servicenow",
    ],
  },
  {
    id: "pat-casey",
    name: "Pat Casey",
    title: "CTO & EVP DevOps / Global Head of Engineering",
    team: "Engineering, DevOps, Cloud Operations & Advanced Technologies",
    influence: "executive",
    commStyle: ["technical", "operational", "data-driven"],
    summary:
      "Long-tenured platform engineer. Owns AI, product and quality engineering, developer productivity, cloud services, advanced technologies, and customer service & support engineering. Wants failure modes named first, then the solution. Skeptical of polish without depth.",
    reviewPreferences: [
      "Pre-read with the technical design — including what you tried and rejected.",
      "Failure modes on slide one. Solution on slide two.",
      "Bring the engineer who owns the code, not just the PM.",
    ],
    visualPreferences: [
      "System diagrams with latency, throughput, and failure-domain annotations.",
      "Operational metrics: SLO compliance, error budget burn, on-call load.",
      "Dependency graphs — what breaks if this breaks.",
    ],
    decisionTriggers: [
      "Failure modes acknowledged, with mitigation paths.",
      "Operational cost named — engineers, on-call, infra spend at scale.",
      "Technical debt position improves, doesn't worsen.",
      "Rollback plan exists and has been thought through.",
    ],
    objections: [
      "Architecture diagrams that hand-wave over data consistency or scale.",
      "Roadmap items with no rollback story.",
      "AI features that ignore latency, cost, and eval cost.",
      "Plans that quietly add tech debt the org will pay for in three quarters.",
    ],
    dos: [
      "State the failure mode you're guarding against on the opening slide.",
      "Bring real operational data — SLO numbers, p99 latency, on-call hours.",
      "Show the rollback plan and the canary criteria.",
      "Name the tech debt this creates or pays down.",
    ],
    donts: [
      "Don't present a happy-path-only diagram.",
      "Don't gloss over the integration cost with the existing platform.",
      "Don't claim AI capabilities without showing eval methodology.",
    ],
    exampleGuidance: [
      "Open with the failure mode the work prevents, not the feature it ships. 'Today our incident MTTR is X because of Y. This change closes that gap by Z.'",
      "Every architecture proposal needs a rollback slide. Not 'we'll add monitoring'; the actual rollback procedure, canary criteria, and who's on the page when it triggers.",
      "If you're using ML/AI, bring the eval methodology and the human-in-the-loop story. 'We tested it and it worked' won't pass; he'll ask for the eval set, the success threshold, and the long-tail behavior.",
    ],
    tags: [
      "executive",
      "cto",
      "engineering",
      "operational",
      "now-platform",
      "reliability",
      "servicenow",
    ],
  },
  {
    id: "jacqui-canney",
    name: "Jacqui Canney",
    title: "Chief People & AI Enablement Officer",
    team: "People & AI Enablement",
    influence: "executive",
    commStyle: ["narrative", "consensus", "customer-centric"],
    summary:
      "People leader. Title expanded in early 2026 to add AI Enablement — owns workforce skilling and the org's adoption of AI agents internally. Cares about how decisions land in the org: culture, talent, employee experience. Will push back on plans that move org charts before considering the human cost.",
    reviewPreferences: [
      "Pre-read with the org impact section flagged.",
      "Show the change-management plan, not just the new structure.",
      "Bring the employee voice — survey data, listening sessions, exit themes.",
    ],
    visualPreferences: [
      "Before/after org structures with the rationale.",
      "Manager-of-managers ratio, span-of-control, leadership pipeline data.",
      "Employee engagement scores with trend lines.",
      "AI skilling adoption metrics for AI-touching roles.",
    ],
    decisionTriggers: [
      "Plans that name the change-management approach explicitly.",
      "Talent and succession implications surfaced, not buried.",
      "Employee voice represented in the proposal.",
      "Leadership development path for the people affected.",
      "AI skilling tie-in — what does the workforce need to learn for this to land?",
    ],
    objections: [
      "Org changes presented as fait accompli without a transition story.",
      "Restructures that ignore the manager-development implication.",
      "Plans that treat people as resources rather than agents.",
      "DEI implications glossed over.",
      "AI initiatives that assume the workforce will pick it up by osmosis.",
    ],
    dos: [
      "Address the people impact in the same breath as the structural change.",
      "Show the listening you did before the recommendation.",
      "Name the leadership development plan for displaced or stretched roles.",
      "If your proposal changes how people work with AI, attach the enablement program.",
      "Surface DEI implications honestly.",
    ],
    donts: [
      "Don't separate the 'org change' slide from the 'people change' slide.",
      "Don't propose a structure without a manager-readiness assessment.",
      "Don't bury succession planning in an appendix.",
    ],
    exampleGuidance: [
      "Any reorg proposal needs three things up front: the structural change, the manager readiness assessment, and the communication plan for affected employees. Missing one and the proposal stalls.",
      "When proposing a hiring plan, attach the listening data. 'We surveyed N managers and heard X' is dramatically more persuasive than headcount math alone.",
      "AI-touching initiatives need an enablement track in the same proposal — what does ServiceNow University need to add, which roles need new competencies, what does the skilling timeline look like.",
    ],
    tags: [
      "executive",
      "people",
      "culture",
      "ai-enablement",
      "talent",
      "consensus",
      "servicenow",
    ],
  },
  {
    id: "chris-bedi",
    name: "Chris Bedi",
    title: "Chief Customer Officer & AI Enterprise Advisor",
    team: "Customer Office, Chief Transformation Office, Digital Technology & Security",
    influence: "executive",
    commStyle: ["customer-centric", "operational", "data-driven"],
    summary:
      "Former ServiceNow CIO (2015–2024), now runs the Customer Office plus the Chief Transformation Office and the internal Digital Technology & Security teams. Translates between buyer needs and internal execution. Wants every recommendation framed against what real customer accounts are actually saying and doing.",
    reviewPreferences: [
      "Lead with the named-customer evidence: which accounts are pushing this, what they're paying, what they're churning from.",
      "Bring the post-sale story — onboarding, time-to-value, expansion, renewal.",
      "Distinguish 'customer wishlist' from 'customer urgency' in the framing.",
    ],
    visualPreferences: [
      "Account-level views: usage trends, NPS, renewal posture, expansion signal.",
      "Post-sale funnel: signed → live → adopted → expanded.",
      "Verbatim customer quotes attributed by role + segment.",
    ],
    decisionTriggers: [
      "Real adoption data from named accounts, not aggregated NPS.",
      "Clear time-to-value story — how many days from signature to first measurable outcome.",
      "Expansion behavior across the workflow portfolio (ITSM → CSM → HR → Creator).",
      "Customer Success motion that scales without linearly scaling CSMs.",
    ],
    objections: [
      "Aggregate 'voice of customer' summaries with no named accounts.",
      "Product launches without a Customer Success motion attached.",
      "Time-to-value claims unbacked by deployment data.",
      "AI features that don't show how a customer's own data improves the experience.",
    ],
    dos: [
      "Open with three named accounts and their current state.",
      "Map the recommendation to the post-sale funnel — what changes for the customer at each stage.",
      "Bring the renewal/expansion signal, not just new logo wins.",
      "Show how customer data flows into and out of the recommendation.",
    ],
    donts: [
      "Don't pitch features without an associated customer outcome and a timeframe.",
      "Don't quote NPS in isolation — pair it with adoption depth and expansion behavior.",
      "Don't propose programs that scale CSMs linearly with revenue.",
    ],
    exampleGuidance: [
      "Any 'customer-led' recommendation needs three named accounts on the opening slide with their state: signed value, current adoption depth, last health signal. Aggregates don't pass his bar.",
      "If you're proposing a new product capability, the Customer Success motion is co-equal with the product itself — onboarding playbook, time-to-value target, expansion trigger. Don't separate the two slides.",
      "For any AI-touching recommendation, show the data loop: what customer data feeds it, what value the customer gets back, where the customer controls / audits it.",
    ],
    tags: [
      "executive",
      "customer",
      "customer-success",
      "transformation",
      "former-cio",
      "operational",
      "servicenow",
    ],
  },
  {
    id: "colin-fleming",
    name: "Colin Fleming",
    title: "EVP & Chief Marketing Officer",
    team: "Global Marketing & Communications",
    influence: "executive",
    commStyle: ["narrative", "customer-centric"],
    summary:
      "Owns the global marketing and communications strategy. Cares about the narrative arc that the field, analysts, press, and prospects all hear. Wants product decisions framed in terms of the category story they advance — not the SKU they create.",
    reviewPreferences: [
      "Pre-read with the message house: one core message, three proof points, named audience.",
      "Tell him what story this advances and what story it threatens.",
      "Bring competitive positioning — who else is making this claim, and why ours wins.",
    ],
    visualPreferences: [
      "Message-house diagrams. Audience-by-audience messaging matrices.",
      "Share-of-voice and analyst-coverage trend data.",
      "Customer reference quality (Gartner, Forrester, named-account quotes).",
    ],
    decisionTriggers: [
      "Recommendation strengthens a category story we already own or are credibly entering.",
      "Analyst-ready proof points — Gartner/Forrester quadrant defensibility.",
      "Named-customer reference willing to go public.",
      "Field-ready: AE has a one-line pitch and a 30-second story.",
    ],
    objections: [
      "Internal-jargon product names that won't survive a customer call.",
      "Recommendations that fragment our message rather than concentrate it.",
      "Claims we can't prove with named references in 60 days.",
      "Category creation without analyst-coverage strategy.",
    ],
    dos: [
      "Frame the recommendation in terms of the message it advances.",
      "Bring the analyst-coverage and reference-readiness story.",
      "Show the field-ready pitch — one line, one story, one proof point.",
      "Name the audience-by-audience messaging variants.",
    ],
    donts: [
      "Don't propose product names without a comms review.",
      "Don't make claims you can't get a customer to repeat on a Gartner call.",
      "Don't ignore the existing narrative — additive or subtractive, but say which.",
    ],
    exampleGuidance: [
      "Any major product launch needs the message house attached: core message, three proof points, named customer references willing to go public in the first 60 days.",
      "If your recommendation introduces a new product name or category, walk through how analysts will cover it, what comparable categories analysts already cover, and who the bar-setter reference customer is.",
      "Field readiness is a launch gate, not an afterthought — bring the AE pitch (one line), the discovery questions (three), and the objection-handling notes (top three).",
    ],
    tags: [
      "executive",
      "cmo",
      "marketing",
      "narrative",
      "analyst-relations",
      "servicenow",
    ],
  },
  {
    id: "jon-sigler",
    name: "Jon Sigler",
    title: "EVP & GM, ServiceNow AI Platform",
    team: "AI Platform (Now Assist / AI Agents)",
    influence: "senior",
    commStyle: ["data-driven", "technical", "narrative"],
    summary:
      "Runs the Now Assist / AI Agents P&L. Owns the bet that drove ARR to $750M in Q1 with a $1.5B target by year end. Wants product decisions framed against the AI Platform's growth velocity, unit economics, and competitive position versus native AI in adjacent platforms.",
    reviewPreferences: [
      "Pre-read with the AI Platform growth curve and the conversion funnel.",
      "Tell him what this does to attach rate, ASP, or NRR for Now Assist.",
      "Bring the competitive view — what does Microsoft / Salesforce / Google offer adjacent to this?",
    ],
    visualPreferences: [
      "Adoption funnel: tenants with Now Assist enabled → active workflows → paid SKUs.",
      "Unit economics: cost-per-inference, gross margin trend, AI infra leverage.",
      "Win/loss data with AI as the deciding factor.",
    ],
    decisionTriggers: [
      "Clear path to AI Platform ARR contribution — which SKU, which conversion motion.",
      "Cost-per-inference modeled and capped, not assumed.",
      "Differentiation versus native AI in the buyer's other platforms.",
      "Eval rigor that wins a technical buyer's eval committee.",
    ],
    objections: [
      "AI features priced as if inference were free.",
      "Demos used as evidence of production readiness.",
      "Roadmap items that don't show up in the Now Assist conversion funnel.",
      "Positioning that doesn't survive comparison to the buyer's existing AI investments.",
    ],
    dos: [
      "Frame the proposal against the Now Assist growth target — how does this contribute?",
      "Show unit economics for the AI usage this drives (cost, margin, scaling factor).",
      "Bring the eval methodology and the human-in-the-loop story.",
      "Position against the named AI features in adjacent platforms.",
    ],
    donts: [
      "Don't pitch AI as a feature checkbox — pitch it as a workflow customers buy.",
      "Don't substitute a demo for an eval suite.",
      "Don't ignore inference cost — at our scale it shows up in gross margin.",
    ],
    exampleGuidance: [
      "Any AI Platform recommendation needs to land against the $1.5B Now Assist target — show whether this contributes ARR directly, increases attach rate, or improves retention. 'Strategic value' isn't sufficient.",
      "Cost-per-inference is non-negotiable. Bring the per-request economics at the realistic usage volume, with a cap and a fallback if inference costs spike.",
      "When positioning against native AI in adjacent platforms, the answer is workflow depth — show concrete cross-workflow scenarios competitors can't run end-to-end.",
    ],
    tags: [
      "senior",
      "ai-platform",
      "now-assist",
      "ai-agents",
      "p-and-l",
      "data-driven",
      "servicenow",
    ],
  },
  {
    id: "joe-davis",
    name: "Joe Davis",
    title: "SVP, Platform Engineering & AI Technology",
    team: "Platform Engineering & AI Technology",
    influence: "senior",
    commStyle: ["technical", "operational"],
    summary:
      "Runs the platform engineering team underneath Pat Casey's org — the infrastructure, services, and AI technology layer that every product line builds on. Wants proposals that respect platform constraints and don't push hidden infra costs onto his org.",
    reviewPreferences: [
      "Pre-read with the platform dependencies enumerated.",
      "Bring the infra cost estimate and the on-call impact.",
      "Tell him what's new for the platform team to support, in plain terms.",
    ],
    visualPreferences: [
      "Service dependency graphs with versioning and SLA implications.",
      "Latency and cost-per-request projections at scale.",
      "Tenant-isolation and multi-tenancy implications for AI workloads.",
    ],
    decisionTriggers: [
      "Platform additions that come with their own operational ownership.",
      "Clear capacity planning, not assumptions of free headroom.",
      "Multi-tenant safety story for any data-plane changes.",
      "AI inference workloads with a cost model and a cap.",
      "Quantified developer experience uplift for the broader org.",
    ],
    objections: [
      "Product teams treating platform capacity as a free externality.",
      "AI/ML workloads with no cost-per-inference model.",
      "Bypasses around the platform that create future migration debt.",
      "Vendor-specific AI dependencies that lock the platform in.",
    ],
    dos: [
      "Name the platform services you'll depend on and the SLOs you assume.",
      "Bring an infra cost model — per-request, per-tenant, at scale.",
      "Show the on-call ownership: who pages when this breaks.",
      "Quantify the platform-wide leverage — does this help one team or all of them?",
    ],
    donts: [
      "Don't assume the platform team will absorb new operational load silently.",
      "Don't propose a workaround that the platform should solve properly.",
      "Don't ignore tenant-isolation in any data-plane change.",
    ],
    exampleGuidance: [
      "Before proposing a new product capability that uses platform primitives, walk through which services it touches and what SLO assumptions you're making. Surprises here are how outages happen.",
      "AI inference at scale needs a cost-per-request model and a cap. 'We'll optimize later' is the answer he's heard most often when budgets blew up.",
      "If your proposal needs a platform feature that doesn't exist yet, surface it as a platform ask with a business case, not as a sneaky bypass.",
    ],
    tags: [
      "senior",
      "engineering",
      "platform",
      "ai-infrastructure",
      "operational",
      "reports-to-pat-casey",
      "servicenow",
    ],
  },
  {
    id: "matt-lombardi",
    name: "Matt Lombardi",
    title: "Global VP, Customer Experience",
    team: "Customer Experience (Chris Bedi's org)",
    influence: "lead",
    commStyle: ["customer-centric", "operational"],
    summary:
      "Runs Customer Experience programs across the install base — onboarding velocity, time-to-value, customer health, and the feedback loop back into product. Closest to where customers actually are in their adoption journey.",
    reviewPreferences: [
      "Pre-read with the affected customer segments named.",
      "Bring data on where customers currently get stuck — onboarding step, adoption depth, support friction.",
      "Distinguish between 'customer says they want this' and 'customer behavior shows urgency'.",
    ],
    visualPreferences: [
      "Customer journey maps with quantified drop-off at each stage.",
      "Adoption depth distributions by segment and tenure.",
      "Health-score breakdowns by workflow.",
    ],
    decisionTriggers: [
      "Measurable reduction in time-to-value, with a starting baseline.",
      "Reduction in the customer-effort score for a known friction point.",
      "Programs that the field can deliver consistently, not just by hero motion.",
      "Voice-of-customer evidence that ties back to product or motion changes.",
    ],
    objections: [
      "Programs justified by NPS movement alone without behavioral evidence.",
      "Recommendations that don't say what the CSM actually does differently.",
      "Customer Success motions that scale headcount linearly with revenue.",
      "VOC quotes without segment or tenure context.",
    ],
    dos: [
      "Lead with the customer-effort point this reduces — name the step, name the friction.",
      "Show what the CSM playbook looks like before and after.",
      "Bring segment-level data, not just population averages.",
      "Tie the recommendation to a measurable change in adoption depth.",
    ],
    donts: [
      "Don't propose new motions that double CSM workload silently.",
      "Don't quote NPS without the behavioral data behind it.",
      "Don't lump 'all customers' together — segment by tenure and workflow mix.",
    ],
    exampleGuidance: [
      "If you're proposing a Customer Experience initiative, the opening slide is the customer journey map with the specific stage you're targeting and the current drop-off rate. Without that baseline, you can't claim improvement.",
      "Every program needs a CSM-playbook diff — what the CSM does today versus tomorrow, with the time impact named. Programs that double CSM workload don't ship.",
      "Voice-of-customer evidence is segment-specific. 'Customers said X' isn't useful; 'mid-market customers under one year tenure with multi-workflow deployments said X' is.",
    ],
    tags: [
      "lead",
      "customer-experience",
      "customer-success",
      "operational",
      "reports-to-chris-bedi",
      "servicenow",
    ],
  },
];

export function getPerson(id: string) {
  return PEOPLE.find((p) => p.id === id);
}

export function getPeople(ids: string[]) {
  return ids.map((id) => PEOPLE.find((p) => p.id === id)).filter(Boolean) as Person[];
}
