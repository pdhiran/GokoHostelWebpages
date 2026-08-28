/**
 * PMS (Aiosell) request/response logging helpers.
 * Logging must never throw — addChannelSyncLog swallows errors.
 */

export const PMS_LOG_MAX_BYTES = 32_000;

const REDACT_KEY = /password|secret|authorization|api[_-]?key|email|phone|firstName|lastName|guestName|address|contact/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEY.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export function serializePmsPayload(value: unknown): string {
  if (value == null || value === "") return "";
  let cleaned: string;
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        cleaned = JSON.stringify(redact(JSON.parse(trimmed)));
      } else {
        cleaned = value;
      }
    } else {
      cleaned = JSON.stringify(redact(value));
    }
  } catch {
    cleaned = typeof value === "string" ? value : "";
  }
  if (cleaned.length <= PMS_LOG_MAX_BYTES) return cleaned;
  return cleaned.slice(0, PMS_LOG_MAX_BYTES) + "...[truncated]";
}

export type PmsLogEntry = {
  direction: "push" | "pull";
  type: string;
  status: "success" | "failed";
  request?: unknown;
  response?: unknown;
  errorMessage?: string;
  recordsAffected?: number;
  httpMethod?: string;
  url?: string;
  httpStatus?: number;
  durationMs?: number;
};

export async function logPmsCall(data: PmsLogEntry): Promise<void> {
  try {
    const { addChannelSyncLog } = await import("@/db/queries");
    await addChannelSyncLog({
      direction: data.direction,
      type: data.type,
      status: data.status,
      requestPayload: serializePmsPayload(data.request),
      responsePayload: serializePmsPayload(data.response),
      errorMessage: data.errorMessage || "",
      recordsAffected: data.recordsAffected || 0,
      httpMethod: data.httpMethod || "",
      url: data.url || "",
      httpStatus: data.httpStatus,
      durationMs: data.durationMs,
    });
  } catch (err) {
    console.error("PMS log failed:", err instanceof Error ? err.message : err);
  }
}
