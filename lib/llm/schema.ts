// JSON Schema for Anthropic tool use. Mirrors RecommendationResult (minus
// server-stamped fields like id, createdAt, generatedBy, model, artifact).

export const RECOMMENDATION_TOOL = {
  name: "submit_recommendation",
  description:
    "Submit the structured recommendation for how to present the artifact (or, if no artifact, how to frame work) for the selected audience.",
  input_schema: {
    type: "object",
    properties: {
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
      emphasize: {
        type: "array",
        items: { type: "string" },
      },
      avoid: {
        type: "array",
        items: { type: "string" },
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
      "summary",
      "audienceRead",
      "fitScore",
      "confidence",
      "keyRisks",
      "recommendedFraming",
      "narrativeStructure",
      "emphasize",
      "avoid",
    ],
  },
} as const;

export type RecommendationToolInput = {
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
  emphasize: string[];
  avoid: string[];
  meetingApproach?: string;
  revisedArtifact?: string;
};
