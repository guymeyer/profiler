import type { ResearchArtifact, Synthesis } from "@/lib/types";

// Builders for "prototype prompts" — text the user copies and pastes into
// Claude (claude.ai or Claude Code) to get a visual artifact (HTML / React)
// that responds to the research or synthesis. Designed to be self-contained:
// the prompt carries everything Claude needs without expecting context from
// the surrounding conversation.

const MAX_RESEARCH_CONTENT_CHARS = 12_000;

export function buildResearchPrototypePrompt(r: ResearchArtifact): string {
  const trimmed =
    r.content.length > MAX_RESEARCH_CONTENT_CHARS
      ? r.content.slice(0, MAX_RESEARCH_CONTENT_CHARS) +
        `\n\n[...truncated from ${r.content.length} chars]`
      : r.content;

  const metaLines: string[] = [];
  if (r.source) metaLines.push(`- Source: ${r.source}`);
  if (r.conductedAt) metaLines.push(`- Conducted: ${r.conductedAt}`);
  if (r.methodology) metaLines.push(`- Methodology: ${r.methodology}`);
  if (r.participants.length > 0)
    metaLines.push(`- Participants: ${r.participants.join(", ")}`);

  return `# Build me a visual prototype from this research

I want a clickable visual prototype that responds to the findings in the research below. Treat this like a quick design exploration, not a finished feature.

## Research: ${r.title}
${metaLines.join("\n")}

### Summary
${r.summary || "(no summary provided)"}

### Full content
${trimmed}

## What I need

1. Read the research and distill the 3 most important findings into "How might we…" questions, grounded in something specific from the content (a behavior, a metric, a quote, a friction point — not generic).
2. Pick the single most consequential HMW.
3. Build a visual prototype (as a Claude Artifact — prefer self-contained HTML + CSS, or a single React component if interactivity helps) that responds to that HMW.

## Constraints

- One prototype, not a full app. The smallest UI that's still meaningful.
- Show the moment-of-use: the screen the user is on when this matters most.
- Inline annotations (small text or callouts) linking parts of the design to specific findings — be explicit about what the design does and why.
- Restrained, modern aesthetic: system font stack, generous whitespace, light background. No emoji decoration, no stock illustrations.
- Fidelity over completeness. Don't sketch ten screens; nail one.

Begin by writing the three HMW questions and your pick of the most consequential one, then deliver the prototype artifact.`;
}

// Per-HMW prompt — same corpus context as the synthesis prompt but locks
// Claude onto a single question instead of asking it to choose. Not
// lens-specific by design ("general solution").
export function buildHmwPrototypePrompt(
  s: Synthesis,
  hmw: string,
): string {
  const outline = s.outline;
  if (!outline) {
    return `# Build me a visual prototype

How might we: ${hmw}

(This synthesis is on an older schema and has no surrounding context to attach. Treat the HMW as standalone.)`;
  }

  const generalLens =
    outline.lenses.general ?? Object.values(outline.lenses)[0];
  const insights = generalLens?.insights ?? [];

  const insightsBlock = insights.length
    ? insights
        .slice(0, 5)
        .map((i, idx) => `### ${idx + 1}. ${i.headline}\n${i.body}`)
        .join("\n\n")
    : "(no insights in this synthesis)";

  const sourcesBlock =
    outline.sources && outline.sources.length > 0
      ? outline.sources.map((src) => `- ${src.title}`).join("\n")
      : "(no sources listed)";

  return `# Build me a visual prototype for this HMW

I want a single visual prototype that responds to the "How might we" question below. Use the surrounding context to ground the design, but stay laser-focused on this one question.

## The question

**How might we ${stripHmwPrefix(hmw)}**

## Surrounding context

### Synthesis: ${outline.title}

### Overview
${outline.overview || "(no overview provided)"}

### Key insights from the corpus
${insightsBlock}

### Source research
${sourcesBlock}

## What I need

Build a visual prototype (as a Claude Artifact — prefer self-contained HTML + CSS, or a single React component if interactivity helps) that responds to the HMW above.

## Constraints

- One prototype, not a full app. The smallest UI that's still meaningful.
- Show the moment-of-use: the screen the user is on when this matters most.
- Inline annotations (small text or callouts) linking parts of the design to specific insights from the context — be explicit about how the design answers the HMW.
- Restrained, modern aesthetic: system font stack, generous whitespace, light background. No emoji decoration, no stock illustrations.
- Fidelity over completeness. Don't sketch ten screens; nail one.

Begin with one sentence on the angle you're taking, then deliver the prototype artifact.`;
}

// Strip a leading "How might we " if present so the question reads
// naturally inside the prompt template ("How might we " + remainder).
function stripHmwPrefix(q: string): string {
  return q.replace(/^how\s+might\s+we\s+/i, "").trim();
}

export function buildSynthesisPrototypePrompt(s: Synthesis): string {
  const outline = s.outline;
  if (!outline) {
    return `# Build me a visual prototype

This synthesis is on an older schema and has no structured content to share. Regenerate it first, then come back to copy the prompt.`;
  }

  // "Doesn't need to be through a specific lens" — use the general lens HMWs
  // and insights. Fall back to whatever lens is present if general is missing.
  const generalLens =
    outline.lenses.general ?? Object.values(outline.lenses)[0];
  const hmw = generalLens?.hmwQuestions ?? [];
  const insights = generalLens?.insights ?? [];

  const hmwBlock = hmw.length
    ? hmw.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "(no HMW questions in this synthesis — regenerate to populate them)";

  const insightsBlock = insights.length
    ? insights
        .slice(0, 5)
        .map((i, idx) => `### ${idx + 1}. ${i.headline}\n${i.body}`)
        .join("\n\n")
    : "(no insights in this synthesis — regenerate to populate them)";

  const sourcesBlock =
    outline.sources && outline.sources.length > 0
      ? outline.sources.map((src) => `- ${src.title}`).join("\n")
      : "(no sources listed)";

  return `# Build me a visual prototype from this research synthesis

I want a clickable visual prototype that responds to the findings in the synthesis below. Treat this like a quick design exploration, not a finished feature.

## Synthesis: ${outline.title}

### Overview
${outline.overview || "(no overview provided)"}

### How might we
${hmwBlock}

### Key insights
${insightsBlock}

### Source research
${sourcesBlock}

## What I need

1. Pick the single most consequential "How might we…" question from the list above.
2. Build a visual prototype (as a Claude Artifact — prefer self-contained HTML + CSS, or a single React component if interactivity helps) that responds to that HMW.

## Constraints

- One prototype, not a full app. The smallest UI that's still meaningful.
- Show the moment-of-use: the screen the user is on when this matters most.
- Inline annotations (small text or callouts) linking parts of the design to specific insights — be explicit about what the design does and why.
- Restrained, modern aesthetic: system font stack, generous whitespace, light background. No emoji decoration, no stock illustrations.
- Fidelity over completeness. Don't sketch ten screens; nail one.

Begin by naming which HMW you chose and why, then deliver the prototype artifact.`;
}
