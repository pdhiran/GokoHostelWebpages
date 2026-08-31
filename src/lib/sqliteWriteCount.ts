/** D1 `stmt.run()` is `{ meta: { changes, rows_written } }`. better-sqlite3 is `{ changes }`. libsql may use `rowsAffected`. */
export function sqliteWriteCount(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const r = result as {
    meta?: { changes?: number; rows_written?: number; rowsAffected?: number };
    rowsWritten?: number;
    rowsAffected?: number;
    changes?: number;
  };
  const n = r.meta?.changes ?? r.meta?.rows_written ?? r.meta?.rowsAffected
    ?? r.rowsWritten ?? r.rowsAffected ?? r.changes ?? 0;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
