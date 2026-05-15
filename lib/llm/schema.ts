// JSON Schema for Anthropic tool use. Mirrors RecommendationResult (minus
// server-stamped fields like id, createdAt, generatedBy, model, artifact).

export const RECOMMENDATION_TOOL = {
  name: "submit_recommendation",
  description:
    "Submit the structured recommendation for how to present the artifact (or, if no artifact, how to frame work) for the selected audience.",
  input_schema: {
    type: "object",
    properties: {
      tldr: {
        type: "string",
        description:
          "TL;DR — a single one or two line takeaway. Maximum ~220 characters. The one thing the user must do, in plain language, before they read anything else. No hedging.",
      },
      summary: {
        type: "string",
        description:
          "2-3 sentence executive summary. State the overall read on the artifact-audience fit and the single most important move to make.",
      },
      audienceRead: {
        type: "string",
        description:
          "How this specific audience will receive the artifact, given their profiles. Reference specific named people when relevant.",
      },
      fitScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "Calibrated 0-100 estimate of how well the artifact, as-is, will land with this audience.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description:
          "Your confidence in this analysis based on artifact completeness and profile coverage.",
      },
      keyRisks: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            severity: { type: "string", enum: ["low", "med", "high"] },
            tiedTo: {
              type: "string",
              description:
                "Name of the specific audience member or objective this risk relates to.",
            },
          },
          required: ["risk", "severity"],
        },
      },
      recommendedFraming: {
        type: "string",
        description:
          "The angle to lead with. One paragraph. Be specific about the opening move.",
      },
      tacticalEdits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description:
                "Where in the artifact to make this edit (e.g. 'Slide 3 headline', 'Paragraph 2', 'Opening line').",
            },
            issue: { type: "string" },
            before: { type: "string", description: "Verbatim current text, if available." },
            after: { type: "string", description: "Specific rewrite." },
            rationale: { type: "string" },
          },
          required: ["location", "issue", "after", "rationale"],
        },
      },
      narrativeStructure: {
        type: "array",
        items: { type: "string" },
        description:
          "Ordered beats for how the story should unfold. Each beat is one short imperative sentence.",
      },
      dos: {
        type: "array",
        minItems: 3,
        items: { type: "string" },
        description:
          "Specific Do's — concrete actions to take when presenting to this audience. Each item is one imperative sentence. Reference a named audience member, objective, or section of the artifact when relevant. No vague advice like 'be clear'.",
      },
      donts: {
        type: "array",
        minItems: 3,
        items: { type: "string" },
        description:
          "Specific Don'ts — concrete things to avoid. Each item is one imperative sentence. Reference a named audience member or known objection when relevant. No vague advice like 'avoid jargon'.",
      },
      practiceQA: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        description:
          "The 3–6 hardest questions this audience will ask about THIS artifact, each with the recommended answer. Be specific — quote artifact passages or numbers the questioner would press on. Don't repeat generic objections from profiles; ground each question in the artifact's content. Order by severity (sharpest first).",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The exact question, phrased as the person would ask it.",
            },
            askedBy: {
              type: "string",
              description:
                "Named audience member most likely to ask this (e.g. 'Daniel Ortiz'). Use a role (e.g. 'CFO') if no specific named person fits.",
            },
            answer: {
              type: "string",
              description:
                "Recommended answer — concrete, no hedging. If the answer requires a number the artifact doesn't supply, say what number to bring.",
            },
            severity: {
              type: "string",
              enum: ["low", "med", "high"],
              description:
                "How load-bearing is this question? 'high' = if you can't answer well, the decision is at risk.",
            },
          },
          required: ["question", "answer", "severity"],
        },
      },
      researchEvidence: {
        type: "array",
        description:
          "When research artifacts are supplied, you MUST cite them here. Each entry pins a specific finding from a named research artifact to a part of the recommendation. Quote or paraphrase from the source — don't invent. Leave empty only if no research was supplied.",
        items: {
          type: "object",
          properties: {
            researchId: {
              type: "string",
              description:
                "The id of the research artifact (provided in the audience block). Must match exactly.",
            },
            finding: {
              type: "string",
              description:
                "What this research shows — a specific claim or quote from the artifact, not a paraphrase of the whole thing.",
            },
            appliedTo: {
              type: "string",
              description:
                "Where in the recommendation this evidence applies — e.g. 'recommendedFraming', 'dos[1]', 'keyRisks[0]'.",
            },
          },
          required: ["researchId", "finding", "appliedTo"],
        },
      },
      okrAlignment: {
        type: "array",
        description:
          "When OKRs are supplied, you MUST map the recommendation to each. For each OKR, state explicitly how landing this recommendation advances it. If the recommendation doesn't clearly advance an OKR, say so — don't fabricate alignment.",
        items: {
          type: "object",
          properties: {
            okrId: {
              type: "string",
              description: "The id of the OKR (provided in the audience block). Must match exactly.",
            },
            advancesHow: {
              type: "string",
              description:
                "How this recommendation moves the needle on the OKR's Key Results. Be specific about which KR(s).",
            },
            alignment: {
              type: "string",
              enum: ["advances", "neutral", "tension"],
              description:
                "advances = this recommendation moves the OKR forward. neutral = no impact. tension = the recommendation conflicts with this OKR (surface that honestly).",
            },
          },
          required: ["okrId", "advancesHow", "alignment"],
        },
      },
      meetingApproach: {
        type: "string",
        description:
          "Only for multi-person audiences: how to run the readout, including pre-reads, who to address what to, and pacing. Leave empty for single-person audiences.",
      },
      revisedArtifact: {
        type: "string",
        description:
          "Markdown of the revised artifact incorporating the recommendations. Leave empty if no artifact was supplied.",
      },
    },
    required: [
      "tldr",
      "summary",
      "audienceRead",
      "fitScore",
      "confidence",
      "keyRisks",
      "recommendedFraming",
      "narrativeStructure",
      "dos",
      "donts",
      "practiceQA",
    ],
  },
} as const;

export type RecommendationToolInput = {
  tldr: string;
  summary: string;
  audienceRead: string;
  fitScore: number;
  confidence: "low" | "medium" | "high";
  keyRisks: { risk: string; severity: "low" | "med" | "high"; tiedTo?: string }[];
  recommendedFraming: string;
  tacticalEdits?: {
    location: string;
    issue: string;
    before?: string;
    after: string;
    rationale: string;
  }[];
  narrativeStructure: string[];
  dos: string[];
  donts: string[];
  practiceQA: {
    question: string;
    askedBy?: string;
    answer: string;
    severity: "low" | "med" | "high";
  }[];
  researchEvidence?: { researchId: string; finding: string; appliedTo: string }[];
  okrAlignment?: {
    okrId: string;
    advancesHow: string;
    alignment: "advances" | "neutral" | "tension";
  }[];
  meetingApproach?: string;
  revisedArtifact?: string;
};
