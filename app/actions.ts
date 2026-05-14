"use server";
import { analyzeArtifact, type AnalyzeInput } from "@/lib/llm/analyze";
import type { RecommendationResult } from "@/lib/types";

export async function runAnalysis(
  input: AnalyzeInput,
): Promise<RecommendationResult> {
  return analyzeArtifact(input);
}
