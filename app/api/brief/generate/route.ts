import { generateBrief, type BriefInput } from "@/lib/llm/brief";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let input: BriefInput;
  try {
    input = (await req.json()) as BriefInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!input?.subject?.name) {
    return new Response(
      JSON.stringify({ error: "subject (with name) is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    const brief = await generateBrief(input);
    return new Response(JSON.stringify({ brief }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Generation failed." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
