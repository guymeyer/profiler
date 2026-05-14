# Profiler — Implementation Plan

A working prototype of **Profiler**: an enterprise intelligence tool that helps users tailor work for specific people, audiences, and business objectives.

This plan is the blueprint for a buildable prototype with mock data and a real LLM-powered analyzer. It is sequenced so that each phase produces a runnable artifact.

---

## 1. Product Recap

**One-line:** A "chief of staff in a tab" — pick a person (or audience), drop in your slide/memo/brief, get sharp, opinionated recommendations on how to land it.

**Primary flows:**
1. Browse people directory → open a person profile.
2. Pick a person (or audience of several + objectives).
3. Paste/upload an artifact.
4. Get a structured recommendation: fit score, risks, edits, suggested rewrites, optional revised version.

**North-star feel:** Linear / Vercel-grade clarity. Reads like an internal intelligence tool, not an HR system.

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SSR for fast first paint, server actions for LLM calls, single deployable. |
| Styling | **Tailwind CSS v4 + shadcn/ui + Radix** | Enterprise-grade primitives, fast iteration, accessible. |
| Icons | **lucide-react** | Pairs natively with shadcn. |
| State | **React Server Components + Zustand** (client islands only) | Server-driven where possible; Zustand for audience builder selections. |
| LLM | **Anthropic SDK, `claude-sonnet-4-6`** (default), `claude-opus-4-7` opt-in | Strong reasoning; structured output via tool use; prompt caching for static profile/objective context. |
| File parsing | **`pdfjs-dist`** (PDF), **`mammoth`** (DOCX), plain text/markdown direct | Covers 90% of artifacts users will drop in. |
| Persistence | **In-memory + JSON seed files** (prototype) → optional **SQLite + Drizzle** in later phase | Avoid DB ceremony until needed; results stored in-memory + localStorage for "recent" lists. |
| Validation | **Zod** | Schemas double as LLM tool-use input schemas. |
| Markdown rendering | **react-markdown + remark-gfm** | For LLM output. |
| Testing (light) | **Vitest** for utilities, **Playwright** smoke for the two golden paths | Skip heavy coverage in prototype. |
| Lint/format | **Biome** | Single tool, fast. |

**Why not a backend service:** The prototype only needs LLM-call orchestration; Next.js server actions handle that. A separate API server adds friction without benefit at this stage.

---

## 3. Repository Layout

```
profiler/
├── app/
│   ├── (marketing)/                # optional landing — skip for v1
│   ├── layout.tsx                  # shell: sidebar nav, top bar, theme
│   ├── page.tsx                    # Home dashboard
│   ├── people/
│   │   ├── page.tsx                # Directory
│   │   └── [personId]/page.tsx     # Profile
│   ├── objectives/
│   │   └── page.tsx                # Library
│   ├── audience/
│   │   └── page.tsx                # Builder (people + objectives multi-select)
│   ├── analyze/
│   │   └── page.tsx                # Artifact analyzer
│   ├── results/
│   │   └── [resultId]/page.tsx     # Recommendation results view
│   └── api/
│       └── analyze/route.ts        # Streaming endpoint (optional; server action default)
├── components/
│   ├── ui/                         # shadcn primitives
│   ├── layout/                     # AppShell, Sidebar, Topbar, CommandK
│   ├── people/                     # PersonCard, PersonProfilePanel, PreferenceBlock
│   ├── objectives/                 # ObjectiveCard, ObjectiveTile
│   ├── audience/                   # AudienceBuilder, SelectedChips, AudiencePreview
│   ├── analyzer/                   # ArtifactInput (paste/upload), TypePicker
│   └── results/
│       ├── ResultsHeader.tsx       # title + fit score + audience pills
│       ├── ExecutiveSummary.tsx
│       ├── AudienceRead.tsx
│       ├── RisksList.tsx
│       ├── TacticalEdits.tsx       # before/after diff cards
│       ├── NarrativeStructure.tsx
│       └── RevisedArtifact.tsx     # markdown view + copy button
├── lib/
│   ├── llm/
│   │   ├── client.ts               # Anthropic client (singleton, server-only)
│   │   ├── prompts.ts              # System prompts + templates
│   │   ├── schemas.ts              # Zod schemas for structured outputs
│   │   ├── analyze.ts              # Orchestrator: builds context, calls LLM, validates
│   │   └── cache.ts                # Prompt-caching helpers
│   ├── data/
│   │   ├── people.ts               # Typed exports of seed people
│   │   ├── objectives.ts           # Typed exports of seed objectives
│   │   ├── seeds/people.json
│   │   ├── seeds/objectives.json
│   │   └── store.ts                # In-memory + localStorage "recent" store
│   ├── parse/
│   │   ├── pdf.ts
│   │   ├── docx.ts
│   │   └── index.ts                # File → text dispatcher
│   └── types.ts                    # Person, Objective, Artifact, Recommendation
├── styles/globals.css
├── public/
├── PLAN.md
├── README.md
├── package.json
├── tsconfig.json
├── biome.json
└── next.config.ts
```

---

## 4. Data Model (TypeScript)

Defined in `lib/types.ts`, mirrored as Zod schemas in `lib/llm/schemas.ts`.

```ts
export type InfluenceLevel = "executive" | "senior" | "lead" | "ic";

export type CommStyle =
  | "data-driven"
  | "narrative"
  | "visual"
  | "operational"
  | "customer-centric"
  | "consensus";

export interface Person {
  id: string;
  name: string;
  title: string;
  team: string;
  influence: InfluenceLevel;
  commStyle: CommStyle[];
  reviewPreferences: string[];       // e.g. "Wants async pre-reads 24h ahead"
  visualPreferences: string[];       // e.g. "Prefers minimal charts, no 3D"
  decisionTriggers: string[];        // What moves them to yes
  objections: string[];              // Predictable pushback
  dos: string[];
  donts: string[];
  exampleGuidance: string[];         // 2–4 paragraph-length sample directives
  summary: string;                   // 1-sentence cardable headline
  tags: string[];
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  successCriteria: string[];
  risks: string[];
  recommendedFraming: string[];
  tags: string[];
}

export type ArtifactType =
  | "slide-deck"
  | "product-brief"
  | "strategy-memo"
  | "design-narrative"
  | "ux-case-study"
  | "data-viz-description"
  | "meeting-notes"
  | "other";

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  rawContent: string;
  selectedPersonIds: string[];
  selectedObjectiveIds: string[];
  createdAt: string;
}

export interface TacticalEdit {
  location: string;                  // "Slide 3, headline" / "Para 2"
  issue: string;
  before?: string;
  after: string;
  rationale: string;
}

export interface RecommendationResult {
  id: string;
  artifactId: string;
  summary: string;                   // 2–3 sentence exec summary
  audienceRead: string;              // How this audience will receive it
  fitScore: number;                  // 0–100
  confidence: "low" | "medium" | "high";
  keyRisks: { risk: string; severity: "low" | "med" | "high" }[];
  recommendedFraming: string;        // The angle to lead with
  tacticalEdits: TacticalEdit[];
  narrativeStructure: string[];      // Ordered beats
  emphasize: string[];
  avoid: string[];
  meetingApproach?: string;          // For multi-person audiences
  revisedArtifact?: string;          // Markdown
  createdAt: string;
}
```

---

## 5. Mock Data Design

Seed at least **8 people** and **7 objectives** so audience-builder combinations feel real.

**People archetypes** (each gets a distinct, opinionated profile — no copy-paste templates):

1. **Maya Chen — CPO** — narrative-first, customer-tied, allergic to vanity metrics.
2. **Daniel Ortiz — VP Engineering** — operational realism, wants risk surfaced early, hates over-polished decks.
3. **Priya Iyer — CEO** — executive optimism, momentum framing, decides on conviction + tempo.
4. **Marcus Webb — CFO** — ROI, sensitivity tables, multi-year horizon, suspicious of soft claims.
5. **Lena Park — Chief Design Officer** — story arc, craft signals, will reject inconsistent visual hierarchy.
6. **Aaron Goldstein — VP Sales** — customer logos, deal-impact stories, wants enablement asks named explicitly.
7. **Sofia Reyes — Head of Data Science** — methodology rigor, calls out unstated assumptions, prefers technical appendices.
8. **Jordan Kim — VP Marketing** — narrative + positioning, audience segmentation, brand-consistency hawk.

Each profile is **hand-written**, not templated, with concrete `exampleGuidance` entries so the LLM has texture to ground recommendations in.

**Objectives** (from spec, with richer fields):
- Increase adoption, Reduce risk, Improve customer confidence, Align leadership, Secure funding, Speed up execution, Validate design direction.

Stored as `lib/data/seeds/*.json` and re-exported through typed wrappers so the LLM context layer can reference them by id.

---

## 6. Page-by-Page Design

### 6.1 Home (`/`)
- Hero strip with two primary CTAs: **Analyze artifact** · **Build audience strategy**.
- Three cards: Recent profiles viewed, Recent artifact reviews, Saved audiences.
- Empty states use illustrated placeholders with a "Try a sample" link (loads a seeded artifact + audience).

### 6.2 People Directory (`/people`)
- Top: search input + filters (team, influence, tag chips).
- Grid of `PersonCard`: avatar (initials block), name, title, team, 1-line preference summary, tag pills.
- Density toggle (comfy / compact). Sort by name / team / recent.

### 6.3 Person Profile (`/people/[id]`)
- Two-column layout: left rail = identity + tags + "Analyze for this person" CTA; right = stacked sections:
  - **Overview** (summary + influence + comm style chips)
  - **Communication preferences**
  - **Presentation preferences** (visual + review)
  - **Decision triggers**
  - **Do's / Don'ts** (two-column green/red list)
  - **Example guidance** (numbered, scrollable)
- Sticky action bar at top with CTAs: *Analyze artifact*, *Add to audience*.

### 6.4 Objectives Library (`/objectives`)
- Card grid; each card shows title, 1-line description, success criteria count, tags.
- Click to expand inline (no separate page needed — keeps the surface light).
- Multi-select checkbox in corner enables "Build audience with selection" floating action.

### 6.5 Audience Builder (`/audience`)
- Left: two stacked pickers — *People* (searchable list with checkbox + chips) and *Objectives* (same).
- Right: live `AudiencePreview` that summarizes selected combo (e.g., "3 execs, mixed comm styles, 2 objectives"). Generate **Audience Strategy** button calls the LLM with a strategy-only prompt (no artifact yet) and renders into a Results-style panel.
- Save audience → persisted to localStorage with a name.

### 6.6 Artifact Analyzer (`/analyze`)
- Tab switcher: **Paste** / **Upload**.
- Title input + type dropdown.
- Audience selector — chip input that opens a popover; reuses Audience Builder pickers. Pre-fills if linked from a profile page.
- Token estimate + cost preview (small, footer-aligned).
- "Generate recommendations" → streams to `/results/[resultId]`.

### 6.7 Results (`/results/[id]`)
- Header: artifact title, audience pills, fit score gauge, confidence badge.
- Sections (collapsible, each anchored in a right-side nav):
  - Executive Summary
  - Audience Read
  - Key Risks (severity-tagged)
  - Recommended Framing
  - Tactical Edits (Before/After cards)
  - Narrative Structure (ordered list of beats)
  - Meeting / Readout Approach (only if multi-person)
  - Revised Artifact (markdown, copy + download .md)
- Sticky actions: copy summary, export markdown, re-run with different audience.

---

## 7. LLM Architecture

### 7.1 Roles
- **System prompt** (constant, cached): the chief-of-staff persona, output discipline, anti-vagueness rules.
- **Context block** (cached per session): the relevant `Person` + `Objective` profiles serialized as structured markdown.
- **Task block** (varies): artifact content + analysis request.

### 7.2 Persona (excerpt)
> You are a senior chief of staff and design strategist embedded in an enterprise. You give blunt, specific, politically-aware guidance. You never say "make it clearer" without showing the concrete fix. You never invent facts about the audience — only use what's in the supplied profiles. When you suggest rewrites, you provide actual prose, not descriptions of prose. If something is missing context, you say so plainly.

### 7.3 Structured output
Use **tool use with a forced tool** to get a typed `RecommendationResult`. Tool schema = Zod → JSON Schema. This eliminates parsing fragility and removes the need for "respond in JSON" instructions.

### 7.4 Prompt caching
Cache breakpoints (in order):
1. System prompt (`cache_control: ephemeral`).
2. Full people-and-objectives library (the entire seed, not just selected ones) so repeat calls from the same session hit cache.
3. The selected audience subset is appended without caching (varies per request).
4. Artifact content is the final, uncached block.

This gives ~80–90% cache hits on the bulky context for a session.

### 7.5 Three prompt variants
- **`analyzeForPerson`** — single person + artifact.
- **`audienceStrategy`** — multiple people + objectives, no artifact (Audience Builder).
- **`analyzeForAudience`** — multiple people + objectives + artifact.

All three share the same output schema; the orchestrator selects the variant and trims sections (e.g., `meetingApproach` only populates for audience variants).

### 7.6 Model selection
- Default: `claude-sonnet-4-6` — fast, sufficient for the task.
- Toggle in advanced panel: `claude-opus-4-7` for "deep analysis" mode (~3× cost, better at tonal nuance and rewrites).

### 7.7 Streaming
- Prefer server actions returning a `ReadableStream`; render skeleton sections that fill as tool-input deltas arrive. Fallback: non-streaming if tool-use streaming proves flaky — first version can ship without streaming.

### 7.8 Anti-generic guardrails (in the system prompt)
- Forbid hedges like "consider", "perhaps", "you may want to".
- Require at least one `before/after` rewrite if the artifact contains prose.
- Require each risk to name the specific audience member or objective it ties to.
- Require `fitScore` to be justified in the summary if < 50 or > 85.

---

## 8. File Upload & Parsing

- `lib/parse/index.ts` accepts a `File`, dispatches by mime type:
  - `text/plain`, `text/markdown` → string.
  - `application/pdf` → `pdfjs-dist` → concatenated page text.
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `mammoth.extractRawText`.
  - Slide decks (`.pptx`) → phase 2 (parse via `pptx2json` or punt to "paste content").
- Cap raw content at ~60k characters pre-LLM; if exceeded, surface a warning and offer a truncation strategy (head + tail, or section-by-section).

---

## 9. UX & Visual Design Principles

- **Neutral, low-chroma palette** — slate/zinc base + a single accent (indigo or teal). No gradients in chrome.
- **Typography:** Inter (UI) + IBM Plex Serif (long-form result body) for a "memo" feel.
- **Density:** generous, not dense — this is a *thinking* tool, not a CRM.
- **Information hierarchy:** every results section starts with a one-sentence headline, then details. No section dumps a wall of bullets without framing.
- **Interaction polish:** keyboard-first (cmd-K to jump to people/audiences/analyze), optimistic UI for selections, skeleton loaders for LLM sections.
- **Accessibility:** Radix primitives, AA contrast minimum, full keyboard nav, prefers-reduced-motion respected on the fit-score gauge.
- **Dark mode** — yes, via shadcn theme.

---

## 10. State & Persistence

- **Server-rendered** for people, objectives, and individual profile pages (static from seeds).
- **Client state** (Zustand store, persisted to localStorage):
  - Selected people / objectives in the audience builder.
  - Recent results (id, title, audience, createdAt, fit score).
  - Saved audiences.
- **Results** themselves live in-memory keyed by `resultId` for the current process; localStorage stores a serialized copy keyed by id so navigating back works after refresh. Good enough for a prototype; swap for SQLite if persistence is needed.

---

## 11. Error & Edge Cases

- LLM call failure → results page renders a recoverable error with a "Retry" that reuses the same context (counts against cache).
- Empty artifact → block submission with an inline hint.
- No audience selected → block submission; show a "pick at least one person" nudge.
- Oversized artifact → warn + offer trim.
- File parse failure → surface a "paste text instead" fallback.
- Profanity / private content → not filtered in prototype; mention in README.

---

## 12. Build Sequence (Phased)

Each phase ends with a runnable, demoable state.

**Phase 0 — Scaffold (½ day)**
- `pnpm create next-app`, Tailwind v4, Biome, shadcn init, base layout shell, sidebar nav, theme toggle, Inter + Plex fonts.
- Commit: "scaffold app shell".

**Phase 1 — Data & static pages (1 day)**
- Hand-author 8 people + 7 objectives JSON seeds.
- Build People Directory + Person Profile + Objectives Library.
- No LLM yet — but the surface should already feel like a real product.

**Phase 2 — Audience Builder (½ day)**
- Multi-select store, chip UI, save audience to localStorage.
- Strategy generation deferred to Phase 4 (button disabled with tooltip).

**Phase 3 — Analyzer UI + single-person LLM (1–1.5 days)**
- Anthropic client, prompts module, Zod schemas, tool-use forced output.
- `analyzeForPerson` variant only.
- Results view renders all sections from a real LLM response.
- Streaming optional — ship non-streaming first if it slows the phase.

**Phase 4 — Audience + objectives extension (½ day)**
- Wire `analyzeForAudience` and `audienceStrategy` variants.
- Add `meetingApproach` rendering in Results.

**Phase 5 — File upload & parsing (½ day)**
- PDF + DOCX + text. Token/character cap with warning.

**Phase 6 — Home dashboard + recents (¼ day)**
- Pull from localStorage. Sample artifact loader.

**Phase 7 — Polish (½ day)**
- Empty states, skeletons, cmd-K palette, fit-score gauge, copy-to-clipboard, markdown export.
- One Playwright smoke test that runs the golden path with a mocked LLM.

**Total:** ~5 working days to a strong demo.

---

## 13. Open Decisions to Confirm Before Build

Items worth a quick check before I start writing code:

1. **Auth?** Spec doesn't mention it. Default: none for the prototype. Add a fake "you are: …" switcher if useful for demo.
2. **Persistence depth.** localStorage + in-memory is fine for a prototype. Confirm — or upgrade to SQLite/Drizzle now if this will be demoed to multiple users from one URL.
3. **Hosting.** Vercel is the natural target; needs `ANTHROPIC_API_KEY` as an env var. Confirm hosting + who provides the key.
4. **Sample people — fictional vs. archetypes of real roles.** Recommendation: fictional names, real titles. Confirm.
5. **Rewrite scope.** Should "Revised artifact" attempt a full rewrite of long inputs, or only the sections that need it? Recommendation: section-level rewrites by default, full rewrite as an opt-in toggle.
6. **Streaming v1.** Ship without streaming first to keep the phase tight, add after Phase 4? Recommendation: yes.
7. **Model default.** Sonnet 4.6 default, Opus 4.7 as opt-in "deep analysis". Confirm.

---

## 14. Definition of Done (for the prototype)

- All 7 spec pages exist and are navigable.
- 8 hand-authored people and 7 objectives render correctly.
- An artifact can be pasted, analyzed for a single person, and the results view renders every documented section with non-generic content.
- An artifact can be analyzed for an audience of ≥2 people + ≥1 objective with a `meetingApproach` section.
- Audience strategy (no artifact) works from the Audience Builder.
- Recent results appear on Home after a session.
- Lighthouse a11y ≥ 95 on directory and results views.
- README documents env setup, model choice, and known limitations.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM output drifts toward generic advice. | Forced tool use + persona rules + explicit anti-hedge list in system prompt + at least one before/after required when prose is present. |
| Long artifacts blow context budgets. | 60k-char cap with summarize-then-analyze fallback. |
| File parsing edge cases (scanned PDFs, etc.). | Always offer "paste instead" fallback; surface parse errors clearly. |
| Result quality varies by person profile depth. | Hand-authored profiles, not templated; each has `exampleGuidance` to anchor the model. |
| Prompt costs creep up with multi-person audiences. | Prompt caching of the full library; only the selected subset is in the uncached tail. |
| Scope creep into PM/HR territory. | Hard-keep this as a presentation-intelligence tool — no performance/HR data anywhere. |

---

This plan is the contract for what gets built. Phase 0 can start immediately once the open decisions in §13 are answered (defaults are safe to assume if no answer is given).
