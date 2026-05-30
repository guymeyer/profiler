"use server";
import Anthropic from "@anthropic-ai/sdk";
import { serializePerson, serializeObjective } from "@/lib/llm/prompts";
import type {
  DeckAudience,
  Objective,
  Person,
  Slide,
  SlideDeck,
  Synthesis,
  SynthesisOutline,
} from "@/lib/types";

// Compresses an existing synthesis into a slide deck shaped for a specific
// audience. NOT a new generation from research — a derivative of the
// outline produced by the synthesis pipeline.

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface GenerateDeckInput {
  synthesis: Synthesis;
  audience: DeckAudience;
  // Resolved audience entities — the caller looks these up from store and
  // passes them so the LLM gets full profile context for each person and
  // the objective definitions.
  audiencePeople: Person[];
  audienceObjectives: Objective[];
  // Free-text instruction layered on top of the standard task. Used when
  // the user regenerates a deck with a tweak ("be more skeptical",
  // "cut to 6 slides", "lead with the funding ask").
  modifier?: string;
  model?: "claude-sonnet-4-6" | "claude-opus-4-7";
}

const SYSTEM_PROMPT = `You are a senior chief of staff compressing an existing research synthesis into a slide deck for a specific audience. You are NOT generating new content — you are choosing what survives and how to land it.

Inputs you receive:
- A research synthesis (title, overview, lens-specific insights, implications, tensions, next moves, sources).
- An audience: 0+ named people with full profiles, 0+ business objectives, an optional intent statement.

Your output is a Slide[] — typically 8 to 15 slides total. Pick from these kinds:

- title — opens the deck. One title, one subtitle line, no bullets.
- setup — single slide that frames the audience on what this is (synthesis title + corpus size + the takeaway in one sentence). 1-2 bullets max.
- insight — the load-bearing slides. One insight per slide. Title is the insight in a sentence; 2-4 bullets supporting it; up to 1 citation line. 4-7 of these typically.
- implication — what to do about it. Same shape as insight but actions, not claims.
- quote — a single pull-quote slide. Use sparingly — once or twice in a deck if a quote actually punches. Empty bullets.
- decision — the ask. Lives near the end. The single call this audience is being asked to make. 0-3 bullets framing the choice.
- sources — the citation list. Last or second-to-last.
- narrative — open prose slot. Use when an idea genuinely needs a paragraph rather than bullets. Use SPARINGLY (at most 1-2 per deck).

Brutal compression rules — NON-NEGOTIABLE:

1. Bullets are ≤12 words. Phrases beat sentences. No prepositional pile-ups.
2. Banned in bullets: "it is important to", "stakeholders should", "various", "things", "many", "some", "potentially", "may want to", "consider", "perhaps".
3. One slide, one idea. If two ideas want to share a slide, they are two slides.
4. The TITLE of each insight/implication slide IS the insight or implication — a declarative sentence, not a topic header. "Adoption stalled because troubleshooting is opaque" not "Troubleshooting issues".
5. Cite when the synthesis cited. Don't invent.
6. Speaker notes per slide: 1-3 sentences. What the presenter says when the slide is on screen, including any caveat that doesn't belong on the slide itself.

Audience shaping — non-negotiable:
- Read each person's profile (communication style, decision triggers, predictable objections, dos/donts) and let it shape: how the title slide opens, what gets compressed, what objection is preempted on a slide, what call-to-action appears on the decision slide.
- Use the intent statement (if present) to set the call-to-action exactly. The deck's purpose is to move THIS room to do THAT thing.
- If the audience has conflicting preferences (e.g., one person wants data, another wants narrative), match the most senior decision-maker; address the others' likely objections on dedicated slides.
- Exec-heavy audience: aim for 8-10 slides total, decision-forward.
- Technical-heavy audience: aim for 12-15 slides, more setup and supporting evidence.

Output the deck via submit_deck. No prose outside the tool call.`;

const DECK_TOOL = {
  name: "submit_deck",
  description:
    "Submit the final slide deck as a structured Slide[] derived from the synthesis.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "Short deck title. Often '<Synthesis title> — for <audience>'.",
      },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "title",
                "setup",
                "insight",
                "implication",
                "quote",
                "decision",
                "sources",
                "narrative",
              ],
            },
            title: { type: "string" },
            subtitle: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            quote: {
              type: "object",
              properties: {
                text: { type: "string" },
                attribution: { type: "string" },
              },
              required: ["text"],
            },
            body: { type: "string" },
            citations: { type: "array", items: { type: "string" } },
            speakerNotes: { type: "string" },
          },
          required: ["kind", "title"],
        },
      },
    },
    required: ["title", "slides"],
  },
} as const;

function serializeOutline(o: SynthesisOutline): string {
  const lensBlocks: string[] = [];
  for (const [lensId, sec] of Object.entries(o.lenses)) {
    if (!sec) continue;
    const insights = sec.insights
      .map((i, idx) => `  ${idx + 1}. ${i.headline} — ${i.body}`)
      .join("\n");
    lensBlocks.push(
      `## Lens: ${lensId}
Summary: ${sec.summary}
Insights:
${insights}
Implications:
${sec.implications.map((x) => `- ${x}`).join("\n")}
Tensions:
${sec.tensions.map((x) => `- ${x}`).join("\n")}
Next:
${sec.next.map((x) => `- ${x}`).join("\n")}`,
    );
  }
  return `# Synthesis: ${o.title}

## Overview
${o.overview}

${lensBlocks.join("\n\n---\n\n")}

## Sources
${o.sources.map((s) => `- ${s.title}: ${s.summary}`).join("\n")}`;
}

function serializeAudience(input: GenerateDeckInput): string {
  const lines: string[] = ["# Audience"];
  if (input.audiencePeople.length > 0) {
    lines.push(
      "\n## Reading this deck (full profiles):",
      input.audiencePeople.map(serializePerson).join("\n\n---\n\n"),
    );
  } else {
    lines.push(
      "\n## Reading this deck: no named individuals (treat as a general audience).",
    );
  }
  if (input.audienceObjectives.length > 0) {
    lines.push(
      "\n## Objectives this deck is presenting against:",
      input.audienceObjectives.map(serializeObjective).join("\n\n---\n\n"),
    );
  }
  if (input.audience.intent?.trim()) {
    lines.push(
      `\n## Intent (the move the presenter wants the room to make):\n${input.audience.intent.trim()}`,
    );
  }
  return lines.join("\n");
}

export async function generateSlideDeck(
  input: GenerateDeckInput,
): Promise<SlideDeck> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildMockDeck(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const model = input.model ?? DEFAULT_MODEL;

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: serializeOutline(input.synthesis.outline),
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: serializeAudience(input) },
  ];
  if (input.modifier?.trim()) {
    userContent.push({
      type: "text",
      text: `# Regeneration modifier\nThe user is regenerating this deck with the following instruction. Honor it on top of the standard task:\n\n${input.modifier.trim()}`,
    });
  }
  userContent.push({
    type: "text",
    text: "Now produce the deck. Call submit_deck with the final Slide[]. Aim for 8-15 slides, compressed to land with the named audience.",
  });

  const stream = client.messages.stream({
    model,
    max_tokens: 12000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [DECK_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: DECK_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });

  const finalMessage = await stream.finalMessage();
  const toolBlock = finalMessage.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error(
      `Model did not return a tool_use block (stop_reason=${finalMessage.stop_reason}).`,
    );
  }
  const data = toolBlock.input as { title?: string; slides?: Slide[] };
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error(
      `Model returned no slides (stop_reason=${finalMessage.stop_reason}). Try again or shorten the synthesis.`,
    );
  }

  return finalizeDeck({
    title:
      data.title?.trim() ||
      defaultTitle(input.synthesis, input.audiencePeople),
    slides: data.slides,
    input,
    generatedBy: "anthropic",
    model,
  });
}

function defaultTitle(synthesis: Synthesis, people: Person[]): string {
  if (people.length === 0) return synthesis.title;
  if (people.length === 1) return `${synthesis.title} — for ${people[0].name}`;
  if (people.length <= 3)
    return `${synthesis.title} — for ${people.map((p) => p.name).join(", ")}`;
  return `${synthesis.title} — for ${people[0].name} + ${people.length - 1} others`;
}

function finalizeDeck(args: {
  title: string;
  slides: Slide[];
  input: GenerateDeckInput;
  generatedBy: "anthropic" | "mock";
  model?: string;
}): SlideDeck {
  return {
    id: `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    synthesisId: args.input.synthesis.id,
    title: args.title,
    audience: args.input.audience,
    slides: args.slides,
    generatedBy: args.generatedBy,
    model: args.model,
    createdAt: new Date().toISOString(),
  };
}

// Deterministic mock — produces a sensible deck from the outline without an
// API key so the demo arc never breaks.
function buildMockDeck(input: GenerateDeckInput): SlideDeck {
  const outline = input.synthesis.outline;
  const general =
    outline.lenses.general ?? Object.values(outline.lenses)[0];
  const insights = general?.insights ?? [];
  const implications = general?.implications ?? [];
  const next = general?.next ?? [];
  const audienceLine =
    input.audiencePeople.length === 0
      ? "for the team"
      : input.audiencePeople.length === 1
        ? `for ${input.audiencePeople[0].name}`
        : `for ${input.audiencePeople[0].name} + ${input.audiencePeople.length - 1} others`;

  const slides: Slide[] = [];

  slides.push({
    kind: "title",
    title: outline.title,
    subtitle: `A read ${audienceLine}`,
    speakerNotes:
      "Open by naming the room, the corpus size, and the one thing you want them to leave with.",
  });

  slides.push({
    kind: "setup",
    title: "What this is",
    bullets: [
      `${outline.sources.length} source${outline.sources.length === 1 ? "" : "s"} synthesized into one read`,
      "Findings ranked by consequence — most important first",
    ],
    speakerNotes:
      "60 seconds. Where this came from, why it's worth their attention.",
  });

  for (const ins of insights.slice(0, 4)) {
    slides.push({
      kind: "insight",
      title: ins.headline,
      bullets: ins.body
        .split(". ")
        .map((s) => s.trim().replace(/\.$/, ""))
        .filter((s) => s.length > 0)
        .slice(0, 3),
      citations: ins.citations,
      speakerNotes:
        "Pause here. Let the headline land before you read the bullets.",
    });
  }

  if (implications.length > 0) {
    slides.push({
      kind: "implication",
      title: "What this implies",
      bullets: implications.slice(0, 4),
      speakerNotes:
        "Frame as decisions you're asking the room to make, not findings.",
    });
  }

  if (input.audience.intent?.trim()) {
    slides.push({
      kind: "decision",
      title: "The ask",
      bullets: [input.audience.intent.trim()],
      speakerNotes:
        "The single most important slide. Say it, then stop talking.",
    });
  } else if (next.length > 0) {
    slides.push({
      kind: "decision",
      title: "What we do next",
      bullets: next.slice(0, 3),
      speakerNotes:
        "Be specific about who owns what by when.",
    });
  }

  slides.push({
    kind: "sources",
    title: "Sources",
    bullets: outline.sources.map((s) => s.title),
    speakerNotes:
      "Available on request. Don't read them aloud — keep the deck moving.",
  });

  return finalizeDeck({
    title: defaultTitle(input.synthesis, input.audiencePeople),
    slides,
    input,
    generatedBy: "mock",
  });
}
