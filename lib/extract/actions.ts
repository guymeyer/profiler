"use server";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/llm/retry";

// Server actions for extracting text from PDF and DOCX uploads. Returns plain
// text plus any extraction warnings — callers feed this into the analyzer
// like any pasted artifact.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB hard cap; pdf-parse loads into memory

export interface ExtractResult {
  text: string;
  warnings: string[];
  kind: "pdf" | "docx" | "text" | "unknown";
  filename: string;
  characterCount: number;
}

export async function extractDocument(
  formData: FormData,
): Promise<ExtractResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file provided.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is ${MAX_BYTES / 1024 / 1024} MB. Trim it or paste as text.`,
    );
  }

  const filename = file.name;
  const lower = filename.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];

  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    type ParserShape = {
      getText: () => Promise<{ text: string; pages?: unknown[]; total?: number }>;
      destroy: () => Promise<void>;
    };
    let parser: ParserShape | null = null;
    try {
      const { PDFParse } = await import("pdf-parse");
      parser = new PDFParse({
        data: new Uint8Array(buf),
      }) as unknown as ParserShape;
      const result = await parser.getText();
      const text = sanitize(result.text);
      const numPages = result.pages?.length ?? result.total ?? 0;
      if (!text.trim()) {
        warnings.push(
          "No extractable text found. This might be a scanned PDF — OCR is not supported in this prototype.",
        );
      } else if (numPages > 50) {
        warnings.push(
          `PDF has ${numPages} pages; the analyzer will truncate to 60,000 characters.`,
        );
      }
      return {
        text,
        warnings,
        kind: "pdf",
        filename,
        characterCount: text.length,
      };
    } catch (err) {
      // Surface the underlying cause — server logs the full stack so we can
      // debug; the user-facing message keeps the actual error type so it's
      // actionable (e.g. "encrypted", "invalid PDF header").
      console.error("[extractDocument] PDF parse failed:", err);
      const msg = (err as Error)?.message ?? String(err);
      throw new Error(`PDF extraction failed: ${msg}`);
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // ignore — already errored
        }
      }
    }
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    const text = sanitize(result.value);
    for (const msg of result.messages ?? []) {
      if (msg.type === "warning") warnings.push(`mammoth: ${msg.message}`);
    }
    if (!text.trim()) {
      warnings.push("DOCX appears empty or contains only images.");
    }
    return {
      text,
      warnings,
      kind: "docx",
      filename,
      characterCount: text.length,
    };
  }

  if (
    file.type.startsWith("text/") ||
    /\.(md|markdown|txt)$/i.test(filename)
  ) {
    const text = sanitize(buf.toString("utf-8"));
    return {
      text,
      warnings,
      kind: "text",
      filename,
      characterCount: text.length,
    };
  }

  throw new Error(
    `Unsupported file type: ${file.type || "unknown"}. Supported: PDF, DOCX, TXT, MD.`,
  );
}

function sanitize(raw: string): string {
  // Collapse excessive whitespace introduced by pdf/docx extraction without
  // collapsing meaningful paragraph breaks.
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ─── Research auto-categorization ──────────────────────────────────────────

export interface CategorizeResult {
  title?: string;
  summary?: string;
  participants?: string[];
  methodology?: string;
  tags?: string[];
  sourceHint?: string;
  bodyMarkdown?: string;
}

const CATEGORIZE_TOOL = {
  name: "categorize_research",
  description:
    "Extract structured metadata from a primary-source research artifact so it can be filed in the team's research library.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "Concise title (max ~80 chars) that names what this research is about. Don't reuse the original filename verbatim if it's generic — invent a descriptive title.",
      },
      summary: {
        type: "string",
        description:
          "1-3 sentence executive summary. State what was studied, who/what was the subject, and the single most important finding. No filler.",
      },
      participants: {
        type: "array",
        items: { type: "string" },
        description:
          "Each entry: 'Name (Role @ Company)' when extractable. Empty array if no named participants are mentioned.",
      },
      methodology: {
        type: "string",
        description:
          "One short sentence: how the research was conducted (e.g. '45-min semi-structured interviews, recorded with consent'). Empty if not stated.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "5-8 lowercase tags. Use kebab-case. Cover topic, segment, theme, timeframe. No spaces.",
      },
      sourceHint: {
        type: "string",
        description:
          "Best inference of who conducted the research — e.g. 'Customer Research Team', 'Sales', a named author. Empty if not extractable.",
      },
      bodyMarkdown: {
        type: "string",
        description:
          "Rewrite the source content as concise, structured markdown — preserving every factual claim, number, named entity, and direct quote verbatim. Strip transcript noise (greetings, scheduling, filler words, repetition), tangents, formatting artifacts, and procedural text that doesn't inform downstream recommendations. Use headings and bullet lists where they aid retrieval. Direct quotes get blockquote (>) formatting and attribution when known. Do NOT add interpretation, summarization beyond compression, or content not present in the source.",
      },
    },
    required: [],
  },
} as const;

const CATEGORIZE_SYSTEM_PROMPT = `You are a research librarian categorizing a primary-source research artifact (interview, study, customer call notes, etc.) so a team can find it and inject it into product/strategy work later.

Rules:
1. Be conservative — leave fields empty rather than invent. The user is going to share these tags and citations with stakeholders; fabricated metadata destroys the tool's credibility.
2. Extract from the text only. Don't infer participants from filenames, vibes, or what you assume the company looks like.
3. Tags should be useful for retrieval: topic, segment, theme, timeframe. Avoid generic tags like "research" or "interview".
4. Summary states what was found, not what was done.
5. bodyMarkdown is a structured rewrite of the original, NOT a summary. Preserve every factual claim, every number, every named entity, every direct quote — verbatim. The compression comes from removing transcript noise (greetings, scheduling chatter, filler words, repetition), tangents that don't inform recommendations, and formatting artifacts (page breaks, headers/footers, line-noise from PDF extraction). Use markdown headings (##) to organize sections and bullet lists for enumerated findings. Format direct quotes as blockquotes with attribution when known. If the source is already short and clean, the markdown rewrite may not be much shorter — that's fine. NEVER invent or interpret.

Output the categorize_research tool call. Do not write prose.`;

const CATEGORIZE_MAX_CHARS = 30_000;

export async function categorizeResearch(args: {
  content: string;
  filename?: string;
}): Promise<CategorizeResult> {
  const text = args.content.trim();
  if (!text) return {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return mockCategorize(text, args.filename);

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const trimmed =
    text.length > CATEGORIZE_MAX_CHARS
      ? text.slice(0, CATEGORIZE_MAX_CHARS) + "\n…[truncated]"
      : text;

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        // Higher cap: bodyMarkdown rewrites long source content; metadata
        // alone fits in <1k tokens but the rewrite can run to several thousand.
        max_tokens: 8192,
        system: CATEGORIZE_SYSTEM_PROMPT,
        tools: [CATEGORIZE_TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: CATEGORIZE_TOOL.name },
        messages: [
          {
            role: "user",
            content: `Original filename: ${args.filename ?? "(none)"}\n\nExtracted text:\n\n${trimmed}`,
          },
        ],
      }),
    );
    const block = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!block) return {};
    const data = block.input as CategorizeResult;
    return {
      title: data.title?.trim() || undefined,
      summary: data.summary?.trim() || undefined,
      participants: (data.participants ?? []).map((p) => p.trim()).filter(Boolean),
      methodology: data.methodology?.trim() || undefined,
      tags: (data.tags ?? [])
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
      sourceHint: data.sourceHint?.trim() || undefined,
      bodyMarkdown: data.bodyMarkdown?.trim() || undefined,
    };
  } catch (err) {
    // Don't block the upload — categorization is best-effort.
    console.error("[categorizeResearch] failed:", err);
    return {};
  }
}

// Crude heuristic so the flow works end-to-end without an API key. Surfaces
// what it could find from the text alone and leaves the rest empty.
function mockCategorize(text: string, filename?: string): CategorizeResult {
  const firstLine = text.split(/\n+/).find((l) => l.trim().length > 0) ?? "";
  const firstSentence =
    text.split(/(?<=[.!?])\s+/).find((s) => s.trim().length > 30)?.trim() ?? firstLine;

  // Pull obvious "Name (Title)" patterns out of the body
  const nameTitle = [
    ...text.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*\(([^)]+)\)/g),
  ].slice(0, 6);

  return {
    title:
      firstLine.length > 4 && firstLine.length < 100
        ? firstLine
        : filename?.replace(/\.[^.]+$/, ""),
    summary: firstSentence.length > 30 ? firstSentence.slice(0, 300) : undefined,
    participants: nameTitle.map((m) => `${m[1]} (${m[2]})`),
    tags: ["draft", "uncategorized", "mock"],
  };
}
