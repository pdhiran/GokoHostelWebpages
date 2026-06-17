/**
 * Auto-inject sync metadata into insert/update operations.
 * Call syncInsert(data) for inserts, syncUpdate(data) for updates.
 */

function getSource(): string {
  return process.env.GOKO_RUNTIME === "pi" ? "pi" : "cloudflare";
}

function now(): string {
  return new Date().toISOString();
}

export function syncInsert<T extends Record<string, any>>(data: T): T & { syncId: string; syncUpdatedAt: string; syncSource: string } {
  return {
    ...data,
    syncId: crypto.randomUUID(),
    syncUpdatedAt: now(),
    syncSource: getSource(),
  };
}

export function syncUpdate<T extends Record<string, any>>(data: T): T & { syncUpdatedAt: string; syncSource: string } {
  return {
    ...data,
    syncUpdatedAt: now(),
    syncSource: getSource(),
  };
}
