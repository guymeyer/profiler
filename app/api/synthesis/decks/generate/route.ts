import {
  generateSlideDeck,
  type GenerateDeckInput,
} from "@/lib/llm/slide-deck";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let input: GenerateDeckInput;
  try {
    input = (await req.json()) as GenerateDeckInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!input?.synthesis?.outline) {
    return new Response(
      JSON.stringify({
        error: "synthesis (with outline) is required.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const deck = await generateSlideDeck(input);
    return new Response(JSON.stringify({ deck }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Generation failed." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
