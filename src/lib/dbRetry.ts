/**
 * Retry wrapper for D1/SQLite queries that fail due to transient errors.
 *
 * Safety guarantees:
 * - READ operations: always safe to retry (no side effects)
 * - WRITE operations (idempotent): safe when the operation produces the same
 *   result if executed twice (e.g. UPDATE SET x = value WHERE id = ?,
 *   DELETE WHERE id = ?). Caller must opt-in via `idempotentWrite: true`.
 * - Non-idempotent writes (e.g. INSERT without unique constraint): NOT retried
 *   by default to avoid duplicates.
 *
 * Only retries on known transient D1 patterns — constraint violations,
 * syntax errors, and other permanent failures are never retried.
 */

const TRANSIENT_PATTERNS = [
  "Failed query",
  "D1_ERROR",
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "network error",
  "socket hang up",
  "ECONNRESET",
];

function isTransientError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("unique constraint") || lower.includes("sqlite_constraint")) return false;
  if (lower.includes("syntax error") || lower.includes("no such table") || lower.includes("no such column")) return false;
  return TRANSIENT_PATTERNS.some((p) => message.includes(p));
}

type RetryOptions = {
  maxRetries?: number;
  delayMs?: number;
  idempotentWrite?: boolean;
};

export async function dbRead<T>(fn: () => Promise<T>, opts?: Pick<RetryOptions, "maxRetries" | "delayMs">): Promise<T> {
  return retry(fn, { ...opts, idempotentWrite: true });
}

export async function dbWrite<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  return retry(fn, opts);
}

async function retry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  const { maxRetries = 1, delayMs = 300, idempotentWrite = false } = opts || {};

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const message = err?.message || String(err);

      if (!isTransientError(message)) throw err;
      if (!idempotentWrite) throw err;
      if (attempt >= maxRetries) throw err;

      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
