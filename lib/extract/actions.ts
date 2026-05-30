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
      if (msg.type !== "warning") continue;
      // Mammoth emits "An unrecognised element was ignored: w:tblPrEx" (and
      // dozens of similar messages) routinely. They mean Word-internal
      // structural elements were skipped; the text content itself is intact.
      // Suppress them so we only surface warnings that actually imply lost
      // content (empty docs, dropped images, etc).
      if (/unrecognised element/i.test(msg.message)) continue;
      warnings.push(`mammoth: ${msg.message}`);
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
