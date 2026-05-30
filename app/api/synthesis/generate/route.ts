import {
  synthesizeResearch,
  type SynthesizeInput,
} from "@/lib/llm/synthesize";

// Blocking JSON endpoint — synthesis is a single shot that produces one
// large HTML payload, so streaming a partially-rendered microsite isn't
// useful. Generation typically runs 20-90s; we lean on the loader UI.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let input: SynthesizeInput;
  try {
    input = (await req.json()) as SynthesizeInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const synthesis = await synthesizeResearch(input);
    return new Response(JSON.stringify({ synthesis }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Generation failed." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
