import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

let sqliteInstance: ReturnType<typeof Database> | null = null;

function getSqliteConnection() {
  if (!sqliteInstance) {
    const dbPath = process.env.SQLITE_PATH || "./goko.db";
    sqliteInstance = new Database(dbPath);
    sqliteInstance.pragma("journal_mode = WAL");
    sqliteInstance.pragma("foreign_keys = ON");
  }
  return sqliteInstance;
}

export function getPiDb() {
  const sqlite = getSqliteConnection();
  return drizzle(sqlite, { schema });
}
