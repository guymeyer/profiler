"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  PRD,
  Person,
  PersonLensSection,
  ResearchArtifact,
  Synthesis,
  SynthesisOutline,
} from "@/lib/types";
import { SYNTHESIS_LENSES } from "@/lib/types";
import { serializePerson } from "@/lib/llm/prompts";
import { buildMockSynthesisOutline } from "@/lib/llm/synthesize-mock";
import { renderSynthesisHtml } from "@/lib/llm/synthesize-render";

// One-shot research synthesis. N research reports → one microsite with:
//   - 8 functional lenses (general + 7 role lenses)
//   - optional N person lenses (microscopic reads using each person's full
//     profile), each with two depths: fullBrief and executiveSummary
//
// We ask the model for STRUCTURED JSON (a SynthesisOutline) and render the
// HTML deterministically. Reliable layout + bounded output budget.

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_REPORT_CHARS = 18_000;

export interface SynthesizeInput {
  title?: string;
  research: ResearchArtifact[];
  // Optional PRDs to fold into the corpus as "planned intent" (vs research,
  // which is observation). Treated as a sibling input to research.
  prds?: PRD[];
  // Optional people to include as microscopic lenses. Empty / omitted =
  // functional lenses only (the original behavior).
  people?: Person[];
  modifier?: string;
  model?: "claude-sonnet-4-6" | "claude-opus-4-7";
}

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior research synthesist embedded in an enterprise. You take a corpus of internal research reports and produce a multi-lens synthesis with TWO kinds of lenses:

1. Functional lenses — fixed roster of common enterprise organizations (Product Design, Product Management, Engineering, Research, Marketing & Comms, Sales & Customer Success, Executive Leadership) plus a "general" audience-agnostic read.
2. Person lenses — microscopic reframes for specific named individuals. The user attaches each person's full profile (title, communication preferences, decision triggers, predictable objections, dos/donts). A person lens reads the same corpus through that specific reader: how would this land for THEM, what would they push back on, what would persuade them, what would they decide to do.

The reader chooses a lens via a sidebar in the rendered microsite. Person lenses additionally have a depth toggle: "Full brief" (depth parity with functional lenses) and "Executive summary" (compressed for a 60-second read).

Operating rules — non-negotiable:

1. Synthesize, do not summarize. Find the through-line across reports. Surface contradictions where they exist. Name what is well-supported vs. thinly supported.
2. The general lens is the default. Make it audience-agnostic — strongest signal, most consequential implications, no per-function bias.
3. Every other functional lens reframes the SAME corpus through a different organization's reading. The underlying evidence does not change; the implications, priorities, and "next moves" do.
4. Each lens-specific section must be useful to a reader in that role. A product designer should leave with new design problems to solve. A PM should leave with new prioritization decisions. Generic insight wastes the reader's time.
5. Cite. In citations[], list research report titles backing each insight. Do not invent titles.
6. Have a point of view. Rank insights. Call out what matters most.
7. No filler. Banned phrases: "it is important to", "stakeholders should consider", "various", "things", "many", "some users". Be specific.
8. Output shape: call submit_outline with the SynthesisOutline JSON. Do not output prose outside the tool call. Do not produce HTML — the host application renders the HTML deterministically from your JSON.

For each functional lens (general + the function-specific ones) provide:
- summary: 2–4 sentence framing of how this lens reads the corpus
- hmwQuestions: 3–5 "How might we..." questions scoped tightly to this corpus and this lens. They must be concrete enough that a reader could brainstorm against them today. Each starts with "How might we " (lowercase after) and references something specific in the research — a behavior, a metric, a friction point, a named segment. No generic HMWs like "How might we improve adoption?".
- insights: 3–5 ranked findings, each with a sharp headline, 2–4 sentence body, and citation titles
- implications: 3–6 bullet-style implications/actions specific to this lens
- tensions: 2–4 honest observations about where evidence is thin, conflicting, or missing
- next: 2–4 next moves (studies to run, decisions to make) ordered by urgency

For each PERSON lens, provide BOTH depths:

- fullBrief (same shape as a functional lens — summary, hmwQuestions, insights, implications, tensions, next). BUT every field is filtered through how this specific person reads, decides, and pushes back. Use their communication preferences and decision triggers as constraints. If their profile lists a predictable objection that this corpus walks into, name it explicitly. If their dos/donts conflict with a recommendation, surface the tension.

- executiveSummary — compressed for a sub-60-second read:
  - tldr: 1-2 sentences. The single thing this person should walk away knowing. Phrase it the way they prefer information: data-first if they're data-driven, story-first if they're narrative-driven, decision-first if they're decisive.
  - keyPoints: 2-4 must-know bullets, ranked. Each bullet is one sentence.
  - callToAction: the single most consequential next move FOR THIS PERSON. A decision they need to make, a meeting they need to call, a stance they need to take publicly.

You MUST produce at least the "general" functional lens. You SHOULD produce every other functional lens you can do a useful read for. If person profiles are attached, you MUST produce a section for each person (both depths) — these are the user's specific stakeholders.

Skip a lens only if there is genuinely no useful read for it from this corpus — and in that case omit it entirely rather than producing filler.`;

function buildOutlineTool(personIds: string[]): Anthropic.Messages.Tool {
  const lensSectionProps = {
    summary: { type: "string" as const },
    hmwQuestions: {
      type: "array" as const,
      description:
        "3-5 'How might we...' questions grounded in the research. Each must reference something specific from the corpus.",
      items: { type: "string" as const },
    },
    insights: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          headline: { type: "string" as const },
          body: { type: "string" as const },
          citations: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
        required: ["headline", "body"],
      },
    },
    implications: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    tensions: { type: "array" as const, items: { type: "string" as const } },
    next: { type: "array" as const, items: { type: "string" as const } },
  };
  const lensSectionRequired = [
    "summary",
    "hmwQuestions",
    "insights",
    "implications",
    "tensions",
    "next",
  ];

  return {
    name: "submit_outline",
    description:
      "Submit the structured research synthesis outline. The host application will render the microsite HTML from this JSON.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        overview: { type: "string" },
        lenses: {
          type: "object",
          description:
            "Per-functional-lens content keyed by lens id. Must include 'general'.",
          properties: Object.fromEntries(
            SYNTHESIS_LENSES.map((l) => [
              l.id,
              {
                type: "object",
                description: `Content for the ${l.name} functional lens. ${l.guidance}`,
                properties: lensSectionProps,
                required: lensSectionRequired,
              },
            ]),
          ),
          required: ["general"],
        },
        people: {
          type: "array",
          description:
            "Person lens sections — one per attached person profile. Each provides both fullBrief and executiveSummary.",
          items: {
            type: "object",
            properties: {
              personId: {
                type: "string",
                description: `Must be one of the supplied person ids: ${personIds.join(", ") || "(none)"}.`,
              },
              personName: { type: "string" },
              fullBrief: {
                type: "object",
                properties: lensSectionProps,
                required: lensSectionRequired,
              },
              executiveSummary: {
                type: "object",
                properties: {
                  tldr: { type: "string" },
                  keyPoints: {
                    type: "array",
                    items: { type: "string" },
                  },
                  callToAction: { type: "string" },
                },
                required: ["tldr", "keyPoints", "callToAction"],
              },
            },
            required: [
              "personId",
              "personName",
              "fullBrief",
              "executiveSummary",
            ],
          },
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
            },
            required: ["title", "summary"],
          },
        },
      },
      required: ["title", "overview", "lenses", "sources"],
    },
  };
}

function serializePRD(p: PRD): string {
  const trimmed =
    p.content.length > MAX_REPORT_CHARS
      ? p.content.slice(0, MAX_REPORT_CHARS) +
        `\n\n[…truncated from ${p.content.length} chars]`
      : p.content;
  const meta: string[] = [];
  if (p.source) meta.push(`Owner: ${p.source}`);
  if (p.status) meta.push(`Status: ${p.status}`);
  if (p.targetShipDate) meta.push(`Target ship: ${p.targetShipDate}`);
  return `### PRD: ${p.title}
${meta.join("\n")}

Summary: ${p.summary}

Problem: ${p.problem}

Proposed solution: ${p.solution}

Target users: ${p.targetUsers.join(", ") || "(unstated)"}

Stated success metrics:
${p.successMetrics.map((s) => `- ${s}`).join("\n") || "(none stated)"}

Full body:
${trimmed}`;
}

function serializeReport(r: ResearchArtifact): string {
  const trimmed =
    r.content.length > MAX_REPORT_CHARS
      ? r.content.slice(0, MAX_REPORT_CHARS) +
        `\n\n[…truncated from ${r.content.length} chars]`
      : r.content;
  const meta: string[] = [];
  if (r.source) meta.push(`Source: ${r.source}`);
  if (r.conductedAt) meta.push(`Conducted: ${r.conductedAt}`);
  if (r.methodology) meta.push(`Methodology: ${r.methodology}`);
  if (r.participants.length > 0)
    meta.push(`Participants: ${r.participants.join(", ")}`);
  return `### ${r.title}
${meta.join("\n")}

Summary: ${r.summary}

Full body:
${trimmed}`;
}

function buildLensRoster(): string {
  return SYNTHESIS_LENSES.map(
    (l) => `## ${l.name} (id: ${l.id})\n${l.guidance}`,
  ).join("\n\n");
}

function buildPeopleRoster(people: Person[]): string {
  if (people.length === 0) return "";
  return `# Person lens roster (attach each person as a microscopic lens)\n\nProduce a person lens section for EACH of the people below. Use their full profile as the filter for that section. Both fullBrief and executiveSummary are required per person.\n\n${people
    .map(serializePerson)
    .join("\n\n---\n\n")}`;
}

export async function synthesizeResearch(
  input: SynthesizeInput,
): Promise<Synthesis> {
  if (!Array.isArray(input.research) || input.research.length === 0) {
    throw new Error("Pick at least one research report to synthesize.");
  }

  const people = input.people ?? [];
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const outline = buildMockSynthesisOutline({
      title: input.title,
      research: input.research,
      prds: input.prds,
      people,
      modifier: input.modifier,
    });
    return finalizeSynthesis({
      outline,
      input,
      generatedBy: "mock",
      model: undefined,
    });
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const model = input.model ?? DEFAULT_MODEL;

  const prds = input.prds ?? [];
  const corpusBlock = `# Research corpus (${input.research.length} report${
    input.research.length === 1 ? "" : "s"
  })\n\nThese are OBSERVATIONS — what users said or did.\n\n${input.research
    .map(serializeReport)
    .join("\n\n---\n\n")}`;

  const prdBlock =
    prds.length > 0
      ? `# Planned intent (${prds.length} PRD${prds.length === 1 ? "" : "s"})\n\nThese are PRDs — what the team plans to build. Treat as INTENT, distinct from the research observations above. The synthesis should surface where intent and observation align, where they diverge, and where the corpus reveals gaps in the planned scope.\n\n${prds.map(serializePRD).join("\n\n---\n\n")}`
      : "";

  const rosterBlock = `# Functional lens roster\n\n${buildLensRoster()}`;
  const peopleBlock = buildPeopleRoster(people);
  const modifierBlock = input.modifier?.trim()
    ? `# Regeneration modifier\nThe user is regenerating this synthesis with the following instruction. Honor it on top of the standard task:\n\n${input.modifier.trim()}`
    : "";

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text: corpusBlock, cache_control: { type: "ephemeral" } },
  ];
  if (prdBlock) userContent.push({ type: "text", text: prdBlock });
  userContent.push({ type: "text", text: rosterBlock });
  if (peopleBlock) userContent.push({ type: "text", text: peopleBlock });
  if (modifierBlock) userContent.push({ type: "text", text: modifierBlock });
  userContent.push({
    type: "text",
    text:
      people.length > 0
        ? `Now produce the outline. Call submit_outline with the final SynthesisOutline JSON. Include the general lens, every function-specific lens you can produce a useful read for, AND a person lens section for each of the ${people.length} attached people (both fullBrief and executiveSummary required for each).`
        : "Now produce the outline. Call submit_outline with the final SynthesisOutline JSON. Include the general lens and every function-specific lens you can produce a useful read for.",
  });

  // Person lenses balloon the output budget — each one is roughly a lens
  // section plus an exec summary. Scale max_tokens with the count.
  const maxTokens = 16000 + people.length * 3500;

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: SYNTHESIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [buildOutlineTool(people.map((p) => p.id))],
    tool_choice: { type: "tool", name: "submit_outline" },
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
  const data = toolBlock.input as Partial<SynthesisOutline> & {
    people?: PersonLensSection[];
  };
  if (!data.lenses || !data.lenses.general) {
    throw new Error(
      `Model returned an outline without the required general lens (stop_reason=${finalMessage.stop_reason}). The output was likely truncated — try again.`,
    );
  }
  const outline: SynthesisOutline = {
    title:
      typeof data.title === "string" && data.title.trim().length > 0
        ? data.title
        : (input.title ?? "Research synthesis"),
    overview: typeof data.overview === "string" ? data.overview : "",
    lenses: data.lenses,
    people: Array.isArray(data.people) ? data.people : undefined,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };

  return finalizeSynthesis({
    outline,
    input,
    generatedBy: "anthropic",
    model,
  });
}

function finalizeSynthesis(args: {
  outline: SynthesisOutline;
  input: SynthesizeInput;
  generatedBy: "anthropic" | "mock";
  model?: string;
}): Synthesis {
  const { outline, input, generatedBy, model } = args;
  const now = new Date().toISOString();
  return {
    id: `syn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: outline.title,
    researchIds: input.research.map((r) => r.id),
    outline,
    html: renderSynthesisHtml(outline),
    modifier: input.modifier?.trim() || undefined,
    generatedBy,
    model,
    createdAt: now,
  };
}
