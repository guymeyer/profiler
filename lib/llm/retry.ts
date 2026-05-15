// Retry helper for transient Anthropic errors (HTTP 529 overloaded, 503, 502,
// transient 5xx). The SDK retries some of these on its own, but 529 has been
// observed to surface through — so this is a belt-and-braces layer.

const TRANSIENT_STATUSES = new Set([502, 503, 504, 529]);

interface MaybeApiError {
  status?: number;
  error?: { type?: string; message?: string };
  message?: string;
}

function isTransient(err: unknown): boolean {
  const e = err as MaybeApiError;
  if (typeof e?.status === "number" && TRANSIENT_STATUSES.has(e.status)) {
    return true;
  }
  if (e?.error?.type === "overloaded_error") return true;
  if (typeof e?.message === "string" && /overloaded|503|529/i.test(e.message)) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FRIENDLY_OVERLOAD =
  "Anthropic is currently overloaded (HTTP 529). I retried a few times — please try again in a minute.";

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 1500;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === maxAttempts) break;
      // Exponential backoff with small jitter
      const delay = base * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
      await sleep(delay);
    }
  }
  if (isTransient(lastErr)) {
    throw new Error(FRIENDLY_OVERLOAD);
  }
  throw lastErr;
}
