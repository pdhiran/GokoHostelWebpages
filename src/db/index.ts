import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

export type Database = BaseSQLiteDatabase<"async" | "sync", unknown, typeof schema>;

let cachedPiDb: Database | null = null;

export function getDb(): Database {
  if (process.env.GOKO_RUNTIME === "pi") {
    if (!cachedPiDb) {
      // eslint-disable-next-line
      const { getPiDb } = require("./pi") as typeof import("./pi");
      cachedPiDb = getPiDb() as unknown as Database;
    }
    return cachedPiDb;
  }

  // eslint-disable-next-line
  const { getCloudflareDb } = require("./cloudflare") as typeof import("./cloudflare");
  return getCloudflareDb() as unknown as Database;
}
