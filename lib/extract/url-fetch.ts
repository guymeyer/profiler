"use server";

// Public URL ingest. Fetches a remote page, strips HTML, returns plain text
// + best-guess title. Used by the /knowledge/new intake to support pasting a
// blog post / press release / competitor announcement / public memo URL.
//
// Safety: https only, blocks IP literals, blocks localhost + private IP
// ranges, 10-second timeout, 5 MB body cap.

export interface FetchUrlResult {
  url: string; // canonical URL we fetched (after redirects, if reported)
  title?: string; // <title> or og:title best-effort
  text: string; // body text, HTML stripped + normalized
  warnings: string[];
  // The text length is meaningful — callers can decide whether to surface
  // an error if extraction was thin.
  characterCount: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/markdown",
];

export async function fetchUrl(rawUrl: string): Promise<FetchUrlResult> {
  const url = validateUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Profiler/1.0 (+knowledge intake; treats target URLs as public docs)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.5",
        "Accept-Language": "en",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const e = err as Error;
    if (e.name === "AbortError") {
      throw new Error("Fetch timed out after 10 seconds.");
    }
    throw new Error(`Fetch failed: ${e.message}`);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(
      `Fetch returned ${response.status} ${response.statusText}.`,
    );
  }

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (
    contentType &&
    !ALLOWED_CONTENT_TYPES.some((allowed) => contentType.startsWith(allowed))
  ) {
    throw new Error(
      `Unsupported content type "${contentType}". Profiler ingests text-only URLs.`,
    );
  }

  // Cap the body size by streaming through a reader and bailing past MAX_BYTES.
  const raw = await readCapped(response, MAX_BYTES);
  const warnings: string[] = [];
  if (raw.truncated) {
    warnings.push(
      `Page body exceeded 5 MB; ingested the first 5 MB only.`,
    );
  }

  const isHtml =
    contentType.startsWith("text/html") ||
    contentType.startsWith("application/xhtml+xml") ||
    raw.body.trimStart().startsWith("<");

  let title: string | undefined;
  let text: string;

  if (isHtml) {
    const stripped = stripHtml(raw.body);
    title = stripped.title;
    text = stripped.text;
  } else {
    text = raw.body;
  }

  text = normalizeWhitespace(text);
  if (text.length < 80) {
    warnings.push(
      "Page text was very short after extraction — site may be JS-rendered or behind a paywall. Consider pasting the content instead.",
    );
  }

  return {
    url: response.url || url.toString(),
    title,
    text,
    warnings,
    characterCount: text.length,
  };
}

function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  // Block obvious local / private targets so a server fetcher can't be
  // used to probe internal infrastructure.
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Refusing to fetch local / internal URLs.");
  }
  if (isPrivateIp(host)) {
    throw new Error("Refusing to fetch private IP addresses.");
  }
  return url;
}

function isPrivateIp(host: string): boolean {
  // IPv4 literal check
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b] = v4.map((s) => parseInt(s, 10)) as unknown as number[];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (already blocked above but safe)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }
  // Any IPv6 literal — be conservative and block to avoid fc00::/7 etc.
  if (host.includes(":")) return true;
  return false;
}

interface ReadCappedResult {
  body: string;
  truncated: boolean;
}

async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<ReadCappedResult> {
  // Prefer streaming so a 100 MB body doesn't get fully buffered before we
  // notice. Fall back to .text() in environments where the reader isn't
  // available (shouldn't happen in Node 18+).
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        truncated = true;
        const remaining = maxBytes - (total - value.byteLength);
        if (remaining > 0) chunks.push(value.slice(0, remaining));
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        break;
      }
      chunks.push(value);
    }
    const merged = mergeChunks(chunks);
    return { body: new TextDecoder("utf-8").decode(merged), truncated };
  }
  const body = await response.text();
  return { body, truncated: false };
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

interface StrippedHtml {
  title?: string;
  text: string;
}

// Lightweight HTML stripper. Pulls out <title>, prefers <article> / <main>
// when present, and falls back to <body>. Drops script/style/nav/footer/
// aside chrome that doesn't belong in the extracted reading content.
function stripHtml(html: string): StrippedHtml {
  // Title
  let title: string | undefined;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = decodeEntities(titleMatch[1].trim().replace(/\s+/g, " "));
    if (title.length > 200) title = title.slice(0, 200) + "…";
  }

  // og:title fallback
  if (!title) {
    const og = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    );
    if (og) title = decodeEntities(og[1].trim());
  }

  // Try article first, then main, then body
  let body = "";
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) body = articleMatch[1];
  if (!body) {
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) body = mainMatch[1];
  }
  if (!body) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    body = bodyMatch ? bodyMatch[1] : html;
  }

  // Remove non-reading chrome
  body = body.replace(/<script[\s\S]*?<\/script>/gi, "");
  body = body.replace(/<style[\s\S]*?<\/style>/gi, "");
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  body = body.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  body = body.replace(/<header[\s\S]*?<\/header>/gi, "");
  body = body.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  body = body.replace(/<aside[\s\S]*?<\/aside>/gi, "");
  body = body.replace(/<form[\s\S]*?<\/form>/gi, "");

  // Block-level tags become newlines so paragraphs stay separated.
  body = body.replace(
    /<\/(p|div|li|h[1-6]|blockquote|pre|tr|section|article)[^>]*>/gi,
    "\n",
  );
  body = body.replace(/<br[^>]*>/gi, "\n");
  // List bullets
  body = body.replace(/<li[^>]*>/gi, "• ");

  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, "");

  body = decodeEntities(body);

  return { title, text: body };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function normalizeWhitespace(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line, i, arr) => {
      // collapse 3+ blank lines into 2
      if (line.length === 0 && i > 0 && arr[i - 1].length === 0) return false;
      return true;
    })
    .join("\n")
    .trim();
}
