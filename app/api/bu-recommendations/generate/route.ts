import {
  generateBURecommendations,
  type BURecommendationsInput,
} from "@/lib/llm/bu-recommendations";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let input: BURecommendationsInput;
  try {
    input = (await req.json()) as BURecommendationsInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!input?.businessUnit?.id) {
    return new Response(
      JSON.stringify({ error: "businessUnit is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const recommendations = await generateBURecommendations(input);
    return new Response(JSON.stringify({ recommendations }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Generation failed." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
