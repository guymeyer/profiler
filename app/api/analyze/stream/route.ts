import {
  analyzeArtifactStreaming,
  type AnalyzeInput,
  type PartialRecommendation,
} from "@/lib/llm/analyze";

// NDJSON streaming endpoint. Each line is one JSON event:
//   { "type": "partial", "partial": { tldr?, fitScore?, ... } }
//   { "type": "complete", "result": RecommendationResult }
//   { "type": "error", "message": string }
// Caller reads the stream and applies partial events to UI state.

export const runtime = "nodejs";
// Streaming + tool-using analyses can run 1-3 minutes on a fresh prompt-cache
// miss. 300 is the Pro plan cap; bump to 800 if you're on Enterprise.
export const maxDuration = 300;

export async function POST(req: Request) {
  let input: AnalyzeInput;
  try {
    input = (await req.json()) as AnalyzeInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      try {
        const result = await analyzeArtifactStreaming(
          input,
          (partial: PartialRecommendation) => {
            send({ type: "partial", partial });
          },
        );
        send({ type: "complete", result });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
