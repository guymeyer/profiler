# Profiler — Project Handoff

A working prototype that turns AI-generated guidance for stakeholder communication into something
stakeholders can't easily dismiss. The core thesis is that recommendations land harder when they're
grounded in (a) the actual decision-makers' profiles, (b) the company's stated objectives and OKRs,
and (c) primary-source research the team has done — and that an LLM can reason over all three at
once if you give it the right structured context.

This document describes the architecture, the design decisions, and the trade-offs as they stand.

---

## TL;DR — what this is

A Next.js 16 (App Router, Turbopack) + Zustand + Anthropic SDK prototype. Everything lives client-side
in `localStorage` via persisted Zustand; server actions and a streaming API route handle LLM calls.

Workflow:

1. Define **people** (your side) and optionally **customers** with their **employees** (their side).
2. Optionally define **OKRs** scoped to the company or a **Business Unit**, attached to specific people.
3. Optionally upload **research** artifacts (PDF/DOCX/MD) — they're text-extracted, auto-categorized,
   and the body is rewritten as clean markdown by Claude.
4. Build an **audience** in the audience builder: pick people, objectives, a customer (and its
   employees), research evidence, OKRs, and write a free-text intent.
5. Run an **analysis** on an artifact (paste or upload PDF/DOCX) — or "strategy mode" with no
   artifact. The result streams in with TL;DR first, then deeper sections fill in.
6. The result page is depth-controlled (Glance / Brief / Standard / Full) and includes diff view
   for revisions, audience deltas ("what if?"), practice Q&A, research citations, and OKR alignment.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) | `serverExternalPackages` configured for pdf-parse/pdfjs-dist/mammoth |
| React | 19.2.4 | Hydration patterns use the `useEffect(() => setHydrated(true), [])` idiom; ESLint may warn but it's intentional |
| State | Zustand 5 with `persist` middleware → localStorage | Key: `profiler-store-v1` |
| LLM | `@anthropic-ai/sdk` 0.96 — `claude-sonnet-4-6` default | Streaming via `messages.stream`, structured output via `tool_use` |
| File parsing | `pdf-parse@2` + `mammoth` | Both are `serverExternalPackages` because of worker boot |
| Styling | Tailwind v4 + small custom component primitives | No design-system library |
| Icons | `lucide-react` 1.16 | |

---

## Top-level surfaces (sidebar nav)

| Route | Purpose | Notes |
|---|---|---|
| `/` | Home dashboard | Recents, featured profiles, saved audiences |
| `/people` | People directory | Seed + custom overlay merged via `useInternalPeople` |
| `/people/[id]` | Person profile | Inline markdown editor with revert-to-seed and AI badge |
| `/people/new` | Create custom person | Blank markdown template |
| `/customers` | Customer companies list | Manual + "Researched" badge |
| `/customers/new` | Add customer | Manual / Deep research tabs; uses Anthropic web_search server tool |
| `/customers/[id]` | Customer detail | Embedded employees section with org chart + drag-rank |
| `/customers/[id]/employees/new` | Add employee under customer | Customer-tagged Person via `customerId` |
| `/research` | Research artifacts library | Tag/search filter |
| `/research/new` | Upload research | PDF/DOCX/MD extract → AI categorize + body rewrite |
| `/research/[id]` | Research detail | Read view + inline edit form |
| `/objectives` | Strategic framings library | Static seed — these are *not* OKRs |
| `/okrs` | OKRs (grouped by Company / BU) + BU CRUD inline | Levels: company / bu |
| `/okrs/new`, `/okrs/[id]` | OKR create / edit | Owners + Attached people are distinct roles |
| `/audience` | Audience builder | Intent + people + customer + customer team + research + OKRs + objectives |
| `/analyze` | Artifact analyzer | Paste/upload; streams results |
| `/results/[id]` | Recommendation view | Depth slider, TL;DR, share-ready copy, feedback loop, diff view |
| `/results/[id]/delta` | "What if?" audience swap | Side-by-side comparison with the original |
| `/api/analyze/stream` | NDJSON streaming endpoint | Server: `client.messages.stream` with `inputJson` events |

---

## Data model (`lib/types.ts`)

### Core entities

```ts
Person {
  id, name, title, team, influence, commStyle[], summary,
  reviewPreferences[], visualPreferences[], decisionTriggers[],
  objections[], dos[], donts[], exampleGuidance[], tags[],
  customerId?,           // when set, this person is a customer's employee
  source?,               // 'manual' | 'research' | 'seed'
  researchedAt?,
  rankWithinLevel?,      // for org chart drag-rank within an influence band
}

Customer {
  id, name, industry?, size?, region?, summary,
  knownStakeholders[], buyingTriggers[], evaluationCriteria[],
  redFlags[], competitiveContext[], notes[], tags[],
  source, researchedAt?, createdAt
}

ResearchArtifact {
  id, title, summary, content,
  source, conductedAt?, participants[], methodology?, tags[],
  linkedPersonIds[], linkedCustomerIds[], linkedObjectiveIds[],
  uploadedFrom?, createdAt, updatedAt?
}

BusinessUnit {
  id, name, description?, leaderPersonId?, createdAt
}

OKR {
  id, objective, keyResults[],
  level: 'company' | 'bu',
  businessUnitId?,
  ownerPersonIds[],         // who drives the OKR
  attachedPersonIds[],      // contributors / stakeholders — drives audience suggestions
  timeframe, status?, notes?, createdAt, updatedAt?
}

Objective {
  id, title, description, successCriteria[], risks[],
  recommendedFraming[], tags[]
}
// Note: Objective is the *seed library* of strategic framings ("Reduce risk").
// OKR is the company-defined goal framework. They coexist intentionally.
```

### The recommendation result

```ts
RecommendationResult {
  id, artifact { title, type, rawContent?, intent?, customer? { id, name },
                 selectedPersonIds, selectedObjectiveIds },
  tldr, summary, audienceRead, fitScore, confidence,
  keyRisks[], recommendedFraming, tacticalEdits[],
  narrativeStructure[], dos[], donts[],
  practiceQA[],                  // 3-6 hardest questions + answers
  researchEvidence?[],           // citations { researchId, finding, appliedTo }
  okrAlignment?[],               // { okrId, advancesHow, alignment: 'advances'|'neutral'|'tension' }
  meetingApproach?, revisedArtifact?,
  generatedBy: 'anthropic' | 'mock', model?, createdAt,
  feedback?: { rating, notes?, createdAt }
}
```

---

## Storage model

**Everything is client-side**. The Zustand store at `lib/store.ts` is persisted to `localStorage`
under the key `profiler-store-v1`. The store holds:

- Audience builder state (selections + intent)
- Saved audiences
- Recent results + result map
- Results view preferences (depth level)
- **`customProfiles`** — overlay over the seed `PEOPLE` array; merged via `useEffectivePeople`
- **`customers`**, **`research`**, **`businessUnits`**, **`okrs`** — full CRUD
- Selection arrays for research and OKRs that flow into the analysis

The cleanest mental model: **seed library = static array (`lib/data/`)**, **client overlay =
Zustand**. The `lib/people-hooks.ts` helpers expose three queries: `useInternalPeople()`
(your side), `useCustomerEmployees(id)` (their side), `useEffectivePeople()` (everyone, used by
the analysis pipeline).

### Trade-off this implies

Multi-user collaboration is not possible without a real backend. Edits don't sync across browsers
or devices. The handoff path to "real product" is adding a Postgres/Supabase layer with auth, then
keeping Zustand as a cache/scratch in front of it.

---

## Analysis pipeline

This is the spine of the product. Trace it end-to-end:

### 1. Audience builder constructs the input

`app/audience/page.tsx` — user picks people, objectives, customer, customer employees, research,
OKRs, and writes intent. All of these are persisted in the store.

### 2. Analyze form gathers + sends

`components/analyzer/analyze-form.tsx` reads everything from the store, plus the artifact title /
type / content. On submit:

- Builds an `AnalyzeInput` payload (see `lib/llm/analyze.ts:AnalyzeInput`).
- `audienceOverrides`: the resolved effective people (custom-edited versions of seed + new custom
  people + customer employees) are passed as full objects so the server doesn't have to look them
  up. This is how edits to a profile actually reach the LLM, even though the cached library block
  uses seed only.
- Calls `runAnalysisStreaming` (defined at the bottom of `analyze-form.tsx`), which POSTs to
  `/api/analyze/stream` and reads NDJSON events.

### 3. Streaming server route

`app/api/analyze/stream/route.ts` is a POST endpoint that returns a `ReadableStream`. Each line is
one JSON event:

```
{"type": "partial", "partial": { tldr?, fitScore?, dos?, ... }}
{"type": "complete", "result": RecommendationResult}
{"type": "error", "message": "..."}
```

It calls `analyzeArtifactStreaming` in `lib/llm/analyze.ts`, which uses
`client.messages.stream(...)`'s `inputJson` event to emit a parsed snapshot of the
tool-input JSON as it accumulates. Snapshots are throttled to ≤ 1 per 200ms.

### 4. Prompts

`lib/llm/prompts.ts`:

- **System prompt** lays out 14 operating rules: be specific, no hedging, ground in profiles, tie
  every risk to a named person/objective, surface conflicts rather than smooth them, **cite
  research when supplied**, **align to OKRs when supplied (including marking tension)**.
- **`buildAudienceBlock`** serializes selected people, objectives, customer, research artifacts
  (with body capped at 8k chars), and OKRs (with BU resolution) into the user message.
- **`buildTaskInstruction`** assembles task-specific guidance based on whether there's an artifact,
  whether the audience is multi-person, whether there's a customer/research/OKRs attached, and
  what the user's intent is.
- **Prompt caching** is enabled on the system prompt and the cached library block (full seed
  catalog). Selected audience subset is re-asserted in the user turn so the model focuses there.

### 5. Tool-use schema

`lib/llm/schema.ts` — the `submit_recommendation` tool. Forced via `tool_choice: { type: "tool", name }`.
Fields, in roughly the order they should arrive during streaming:

```
tldr → summary → audienceRead → fitScore → confidence
  → keyRisks → recommendedFraming → tacticalEdits → narrativeStructure
  → dos → donts → practiceQA
  → researchEvidence → okrAlignment
  → meetingApproach → revisedArtifact
```

Required fields force the model to always produce TL;DR + Do's + Don'ts + Practice Q&A. Research
evidence and OKR alignment are required *by system rule* when those inputs are attached.

### 6. Mock fallback (`lib/llm/mock.ts`)

When `ANTHROPIC_API_KEY` is unset, the analyze action produces a deterministic recommendation
built from profile data. This isn't a placeholder — it's a real, profile-grounded heuristic that
mirrors the schema, produces TL;DR / Do's / Don'ts / practice Q&A / research citations / OKR
alignment from the same inputs. Two paths:

- `buildMockRecommendation` — has at least one person selected
- `buildObjectiveOnlyMock` — objective-only or customer-only audiences (unknown decision-maker)

Mock-mode results are clearly labeled in the UI ("Mock mode" badge, "Heuristic — no Claude key"
chip on the TL;DR).

### 7. Retry layer

`lib/llm/retry.ts` — wraps every LLM call. Retries on HTTP 502/503/504/**529** (overloaded) with
exponential backoff + jitter. After exhausting retries, throws a friendly message instead of the
raw JSON. The Anthropic SDK's built-in `maxRetries: 2` runs first, then ours on top — total
budget ~5 attempts for a transient overload spike.

---

## File parsing pipeline

`lib/extract/actions.ts` — server actions for uploads. Two functions:

### `extractDocument(formData)`

- Routes by mime type / extension to `pdf-parse` (PDF), `mammoth` (DOCX), or direct UTF-8 read
  (TXT/MD).
- Caps at 10 MB. The Server Actions body size limit is set to `10mb` in `next.config.ts` to
  match (default is 1 MB — that was the cause of the initial upload 413 errors).
- Returns `{ text, warnings, kind, filename, characterCount }`. Warnings are surfaced to the user
  for scanned PDFs (no OCR), big page counts, etc.
- `pdf-parse@2` uses `PDFParse` class API: `new PDFParse({ data })` → `parser.getText()` → must
  `await parser.destroy()`.

### `categorizeResearch({ content, filename })`

- Runs after a successful upload in the research form.
- Calls Sonnet 4.6 with a `categorize_research` tool that returns:
  - `title`, `summary`, `participants[]`, `methodology`, `tags[]`, `sourceHint`
  - **`bodyMarkdown`** — a structured markdown rewrite of the source content. Strict rules:
    preserve every factual claim, number, named entity, direct quote verbatim. Strip transcript
    noise / tangents / formatting artifacts. Never invent.
- `max_tokens: 8192` to give the body rewrite room.
- Failures are silent (best-effort) — categorization should never block a successful upload.

---

## Result surface

`app/results/[resultId]/page.tsx` is the densest page. Pieces:

- **Depth control** at the top — segmented 4-stop slider (Glance / Brief / Standard / Full).
  Persisted in the store as `resultsDepth`. Keyboard `1`-`4`.
- **TL;DR card** (always) with the share-ready "Copy for Slack" button (TL;DR + Do's + Don'ts +
  audience + fit score, as plain text). Keyboard `c`.
- **Intent card** (when set), **Executive summary** (≥ 2), **Audience read** (≥ 3),
  **Key risks** (≥ 2), **Research evidence** (≥ 2 if present), **OKR alignment** (≥ 2 if present),
  **Recommended framing** (≥ 3), **Tactical edits** (≥ 4), **Narrative structure** (≥ 4),
  **Do's / Don'ts** (always — these are the floor), **Practice Q&A** (≥ 3), **Meeting approach**
  (≥ 3 if multi-person), **Revised artifact** (≥ 4 with Revised/Side-by-side/Diff toggle).
- **Feedback section** (👍/👎 + optional notes) persisted on the result.
- **"What if?"** entry → `/results/[id]/delta` — re-runs analysis with swapped audience and shows
  diff side-by-side.

### Diff view

The revised artifact uses a small in-file LCS line-diff (`lineDiff` in
`app/results/[resultId]/page.tsx`). No external diff dep. Three modes: Revised only,
Side-by-side (original vs. revised markdown), Diff (inline LCS with adds in green and removes in
red with strike-through).

### Audience delta

`app/results/[resultId]/delta/page.tsx` — local audience picker seeded from the original result.
On "Run delta", calls the streaming endpoint and renders a comparison view: fit-score chip with
trend arrow, side-by-side TL;DR, and per-list (Do's / Don'ts) diff with added/removed/unchanged
sections.

---

## Markdown conventions

Two entity types use markdown for editing:

- **Person profiles** (`lib/profile-md.ts`) — round-trip parser/serializer. Top metadata as
  `- Key: value` bullets (Title, Team, Influence, Communication style, Tags, optional Customer,
  optional Rank). Sections as `## Heading` (Summary, Communication preferences, Presentation
  preferences, Decision triggers, Predictable objections, Do's, Don'ts, Example guidance).
- **Customers** (`lib/customer-md.ts`) — same pattern. Top metadata (Industry, Size, Region, Tags).
  Sections (Summary, Known stakeholders, Buying triggers, Evaluation criteria, Red flags,
  Competitive context, Notes).

Both parsers are lenient on read (accept variations in heading names via alias map) and canonical
on write. Both return `{ entity, warnings[] }` so unrecognized sections or invalid enum values
surface to the user.

Research is *not* edited as markdown (form-based metadata + a body textarea) but the body is
itself markdown after the AI rewrite pass.

---

## Honest trade-offs

These are known and intentional given the prototype's scope.

### Storage is browser-local

Everything in Zustand → localStorage. No multi-user, no cross-device. The structural ceiling for
adoption — adding a real backend is the single biggest unlock.

### Profile edits are partly inconsistent in the cached library block

When a person is edited, the **audience block** in the prompt uses the override (passed via
`audienceOverrides`). The **cached library block** at the top of the user message still uses the
seed `PEOPLE` array. This keeps prompt caching warm but means the model sees seed Maya in the
"all known people" reference and edited Maya in the "selected audience" — a small inconsistency
the model handles fine in practice. If profile edits ever need to be authoritative end-to-end,
invalidate caching and serialize the merged catalog.

### Mock mode TL;DR is heuristic

The "Heuristic — no Claude key" chip is shown on TL;DR in mock mode. The mock recommendation is
*useful* (profile-grounded, deterministic, real Do's/Don'ts) but it isn't analysis. Users should
not mistake mock output for real analysis when sharing screenshots.

### Streaming partial JSON is best-effort

We emit `inputJson` snapshots throttled at 200ms. Field arrival order roughly matches schema
order, but no guarantee a partial snapshot is well-formed at any given tick. UI guards every
streamed field with `?.` / `?? []`.

### PDF/DOCX parsing is text-only

Scanned PDFs fail gracefully ("no extractable text"). No OCR. Tables and complex layout get
collapsed to plain text. Mammoth catches some DOCX warnings (e.g. unsupported elements) and
surfaces them.

### No tests

The codebase has no automated tests. As surface area grows this is increasingly a problem. The
two markdown round-trip libraries (`profile-md.ts`, `customer-md.ts`) and the small `lineDiff`
helper are the most obvious candidates for a Vitest suite.

### ESLint warnings persist

`react-hooks/set-state-in-effect` fires on the hydration pattern used throughout
(`useEffect(() => setHydrated(true), [])`). This is consistent across the codebase and the build
passes — not currently worth churning.

---

## Key files map

```
app/
  page.tsx                                Home dashboard
  layout.tsx                              Root layout, sidebar slot
  actions.ts                              `runAnalysis` server action (non-streaming fallback)
  audience/page.tsx                       Audience builder — intent, people, customer, customer team,
                                            research, OKRs, objectives, conflict surfacing
  analyze/page.tsx                        Hosts the AnalyzeForm
  people/, customers/, research/, okrs/   CRUD pages described above
  results/[resultId]/page.tsx             Result view + depth slider + feedback + diff view
  results/[resultId]/delta/page.tsx       "What if?" audience swap + comparison
  api/analyze/stream/route.ts             NDJSON streaming endpoint
  customers/actions.ts                    researchCustomer + researchCustomerStakeholders
                                            (Anthropic web_search server tool)

components/
  layout/sidebar.tsx                      Top-level nav
  analyzer/analyze-form.tsx               Streams analysis, side-bar chips
  research/research-form.tsx              Upload + AI categorize + body rewrite
  okrs/okr-form.tsx                       OKR create/edit
  admin/markdown-editor.tsx               Reusable Edit/Preview tabbed editor
  people/recent-for-person.tsx            Client component on Person profile

lib/
  types.ts                                All entity types + result shape
  store.ts                                Zustand store (persisted to localStorage)
  utils.ts                                cn(), id(), initials()
  audience-conflicts.ts                   Comm-style + influence-shape warnings
  people-hooks.ts                         useInternalPeople / useCustomerEmployees /
                                            useEffectivePeople + sortByOrgChart
  profile-md.ts                           Person markdown round-trip
  customer-md.ts                          Customer markdown round-trip
  extract/actions.ts                      extractDocument + categorizeResearch
                                            (Anthropic + pdf-parse + mammoth)
  data/
    people.ts                             8 seed profiles
    objectives.ts                         7 seed strategic framings
    sample-artifacts.ts                   3 demo artifacts
  llm/
    prompts.ts                            System prompt + all serializers
    schema.ts                             submit_recommendation tool schema
    analyze.ts                            analyzeArtifact + analyzeArtifactStreaming
    mock.ts                               Deterministic mock-mode recommendation builder
    retry.ts                              withRetry for transient Anthropic errors

next.config.ts                            serverExternalPackages + 10mb body limit
```

---

## What's next (open recommendations)

Several previously-prioritized items remain unshipped:

- **Persona simulation** — have Claude role-play one of the selected audience members reading the
  artifact and emit paragraph-by-paragraph reactions. The killer feature; deliberately deferred.
- **Multi-user backend** — the single biggest unlock for adoption. Needs auth + Postgres/Supabase
  + a migration story for users who already have localStorage data.
- **Custom profile schema for non-people entities** — e.g. partners, regulators. Currently
  Customer + Person cover most cases.
- **Slack / Linear / Notion ingestion** — pull artifact content from a Linear ticket or Notion
  page instead of paste/upload.
- **Calendar attendee prefill** — Google Calendar / Outlook integration to pre-populate audience
  from a meeting invite.
- **Vitest suite** — at minimum cover the two markdown round-trips, `lineDiff`, and the audience
  conflict detector.

---

## Operational notes

- Default model: `claude-sonnet-4-6`. Configured via `DEFAULT_MODEL` in `lib/llm/analyze.ts`.
- API key: `ANTHROPIC_API_KEY` in `.env.local`. Without it, the app runs in mock mode end-to-end
  including research categorization and customer/stakeholder discovery (each has its own mock).
- A `NEXT_PUBLIC_HAS_ANTHROPIC_KEY=1` mirror is checked client-side just for UI labeling — it
  doesn't affect functionality.
- Web search: customer + stakeholder research use Anthropic's built-in `web_search_20250305`
  server tool with `max_uses: 5–8`. No additional setup required beyond the API key.
- pdf-parse v2's worker is fragile under Turbopack — pdf-parse, pdfjs-dist, and mammoth are
  marked `serverExternalPackages` in `next.config.ts`. Don't bundle them.
- Server Actions body limit raised to 10 MB to match the internal upload cap. Default is 1 MB.

---

## Closing note

The wedge across every feature is the same: turn AI guidance into something stakeholders can't
easily dismiss. That's why TL;DR + Do's + Don'ts are the always-visible floor, why research
evidence and OKR alignment are required at depth 2 and not buried at depth 4, why we ask the model
to mark OKR `tension` instead of fabricating alignment, why edits are auditable, and why mock mode
is labeled honestly. The discipline is baked into the prompt rules (`SYSTEM_PROMPT` in
`lib/llm/prompts.ts`) — read those rules first if you're trying to understand the product's
opinion about what good output looks like.
