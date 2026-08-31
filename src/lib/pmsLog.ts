/**
 * PMS (Aiosell) request/response logging helpers.
 * Logging must never throw — addChannelSyncLog swallows errors.
 */

export const PMS_LOG_MAX_BYTES = 32_000;

export function serializePmsPayload(value: unknown): string {
  if (value == null || value === "") return "";
  let cleaned: string;
  try {
    cleaned = typeof value === "string" ? value : JSON.stringify(value);
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

/** Escape `%` `_` `\` so an admin type filter cannot become a LIKE wildcard. */
export function sqliteLikePrefix(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_") + " (%";
}
