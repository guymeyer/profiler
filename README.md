# Profiler

> Audience intelligence for enterprise work. Open a profile to see how a person prefers work framed, reviewed, and communicated. Drop in an artifact and get sharp, specific recommendations on how to land it.

A working prototype of the app spec'd in [`PLAN.md`](./PLAN.md).

## Quick start

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

To enable real LLM-powered analysis, set an `ANTHROPIC_API_KEY` in `.env.local`:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
pnpm dev
```

Without the key, the app runs in **mock mode** — analysis is generated
deterministically from the selected people + objectives. Output is real and
profile-grounded; just less nuanced than Claude. Mock mode is clearly labelled
in the UI.

## What's built

- **Home** — entry CTAs, featured profiles, recent analyses, saved audiences.
- **People directory** — 8 hand-authored profiles, searchable + tag-filterable.
- **Person profile** — overview, communication & presentation preferences,
  decision triggers, predictable objections, dos/don'ts, example guidance,
  inline "Analyze artifact" and "Add to audience" actions.
- **Objectives library** — 7 objectives with success criteria, common risks,
  and recommended framing. Multi-select to feed the audience builder.
- **Audience builder** — multi-select people and objectives, save and load
  named audiences, live preview of the audience composition.
- **Artifact analyzer** — paste or upload markdown/text, pick audience,
  pick (optional) objectives, generate recommendations. Three sample
  artifacts ship with the prototype for instant demo.
- **Results** — fit score gauge, executive summary, audience read, key risks
  (each tied to a named person or objective), recommended framing, tactical
  edits with before/after, narrative structure, emphasize/avoid lists,
  meeting/readout approach for multi-person audiences, revised artifact
  (copyable + downloadable markdown).

## LLM design

- **Model**: `claude-sonnet-4-6` by default.
- **Structured output**: forced tool use (`submit_recommendation`). The
  recommendation schema lives in `lib/llm/schema.ts`.
- **Prompt caching**: the system prompt and the full reference library
  (every person and objective) are cached. Only the selected subset plus
  the artifact varies per request, so repeat analyses in a session are
  fast and cheap.
- **Persona**: a senior chief-of-staff / design strategist. Banned hedge
  phrases, mandatory specificity, risks must be tied to named audience
  members or objectives, before/after rewrites required when prose is
  worth rewriting.

See `lib/llm/prompts.ts` and `lib/llm/analyze.ts`.

## Project layout

```
app/
  page.tsx                  Home dashboard
  people/                   Directory + [personId] profile
  objectives/               Library
  audience/                 Builder
  analyze/                  Artifact analyzer (uses ?personIds=…&objectiveIds=…&strategy=1)
  results/[resultId]        Recommendation view
  actions.ts                Server action wrapper for runAnalysis
components/
  layout/                   Sidebar, Topbar
  ui/                       Button, Card, Badge, Input, Avatar (mini shadcn-style)
  people/                   PersonCard
  audience/                 AddToAudience
  analyzer/                 AnalyzeForm
lib/
  data/
    people.ts               8 typed profiles
    objectives.ts           7 typed objectives
    sample-artifacts.ts     3 demo artifacts
  llm/
    prompts.ts              System prompt + serializers
    schema.ts               JSON-Schema for forced tool use
    analyze.ts              Orchestrator (Anthropic SDK + caching, with mock fallback)
    mock.ts                 Deterministic recommendation builder
  store.ts                  Zustand store (audiences, recents, results)
  types.ts                  Person / Objective / Artifact / RecommendationResult
  utils.ts                  cn(), initials(), id()
scripts/
  smoke-analyze.ts          Mock recommendation smoke test
```

## Persistence

Pure client-side: Zustand + `localStorage`. No database. Generated results
live in the same store keyed by `resultId`, so links survive refresh on the
machine that generated them but don't transfer across browsers. Swap to
SQLite + Drizzle if persistence across users matters.

## Known limitations

- **File parsing**: text and markdown only. PDF and DOCX support is staged in
  the plan; the UI surfaces the limit with a "paste instead" fallback.
- **No auth**: anyone with the URL can use the app.
- **No streaming**: results return all at once. Acceptable for prototype
  latency; the model call is ~3–8 seconds depending on artifact length.
- **Mock mode quality**: deterministic, profile-grounded, and useful for
  demos — but it's pattern-driven, not insight-driven. Always set
  `ANTHROPIC_API_KEY` for real feedback.

## Scripts

```bash
pnpm dev                          # dev server
pnpm build && pnpm start          # production build
pnpm exec tsc --noEmit            # type-check
pnpm exec tsx scripts/smoke-analyze.ts   # mock recommendation smoke test
```

## Status

Phase 0–7 from `PLAN.md` are complete. Full walking skeleton with all spec
pages, real LLM integration, and a graceful mock fallback. Ready for a demo;
ready to extend.
