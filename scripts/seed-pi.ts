/**
 * Seed Pi SQLite from Cloudflare D1 via HTTP API.
 * Downloads all text data from D1 and initializes the Pi's local SQLite database.
 *
 * Usage:
 *   CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_D1_TOKEN=xxx CLOUDFLARE_DATABASE_ID=xxx npm run seed:pi
 *
 * Prerequisites:
 *   - Pi migrations must be applied first: npm run db:migrate:pi
 *   - better-sqlite3 must be installed
 */

import Database from "better-sqlite3";
import crypto from "crypto";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const D1_TOKEN = process.env.CLOUDFLARE_D1_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID;
const DB_PATH = process.env.SQLITE_PATH || "./goko.db";

if (!ACCOUNT_ID || !D1_TOKEN || !DATABASE_ID) {
  console.error("Required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_TOKEN, CLOUDFLARE_DATABASE_ID");
  process.exit(1);
}

const TABLES_TO_SEED = [
  "checkins", "dorms", "beds", "bed_history", "bookings",
  "menu_categories", "menu_items", "food_orders", "food_order_items", "order_modifications",
  "accounts", "vendors", "employees", "salary_payments",
  "daily_income", "daily_ledger", "expenses",
  "users", "qr_history",
];

const SETTINGS_TO_SEED = [
  "image_validation", "guest_min_age", "guest_max_age", "show_dob_in_records",
  "log_level", "food_tax_rate", "food_kitchen_hours", "food_tab_limit",
  "food_kitchen_busy", "food_confirm_with_guest", "food_kannada_labels",
  "food_cafe_tables", "primary_server",
];

async function queryD1(sql: string): Promise<any[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`);
  }

  return json.result?.[0]?.results || [];
}

async function main() {
  console.log(`Seeding Pi SQLite at: ${DB_PATH}`);
  console.log(`From Cloudflare D1: ${DATABASE_ID}\n`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = OFF");

  let totalRows = 0;

  for (const table of TABLES_TO_SEED) {
    try {
      const rows = await queryD1(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (empty)`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
      const stmt = db.prepare(insertSql);

      const insertAll = db.transaction((records: any[]) => {
        for (const row of records) {
          const values = columns.map((col) => row[col] ?? null);
          stmt.run(...values);
        }
      });

      insertAll(rows);

      // Backfill sync_id for rows that don't have one
      const syncIdCol = columns.includes("sync_id");
      if (syncIdCol) {
        const needsSyncId = db.prepare(`SELECT id FROM ${table} WHERE sync_id IS NULL`).all();
        if (needsSyncId.length > 0) {
          const updateStmt = db.prepare(`UPDATE ${table} SET sync_id = ?, sync_source = 'cloudflare' WHERE id = ?`);
          const backfill = db.transaction(() => {
            for (const row of needsSyncId as any[]) {
              updateStmt.run(crypto.randomUUID(), row.id);
            }
          });
          backfill();
        }
      }

      console.log(`  ${table}: ${rows.length} rows seeded`);
      totalRows += rows.length;
    } catch (err: any) {
      console.error(`  ${table}: FAILED - ${err.message}`);
    }
  }

  // Seed settings (only whitelisted keys)
  try {
    const allSettings = await queryD1("SELECT * FROM settings");
    const filtered = allSettings.filter((s: any) => SETTINGS_TO_SEED.includes(s.key));
    if (filtered.length > 0) {
      const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value, sync_source) VALUES (?, ?, 'cloudflare')");
      const insertSettings = db.transaction(() => {
        for (const s of filtered) {
          stmt.run(s.key, s.value);
        }
      });
      insertSettings();
      console.log(`  settings: ${filtered.length} keys seeded (${SETTINGS_TO_SEED.length} whitelisted)`);
      totalRows += filtered.length;
    }
  } catch (err: any) {
    console.error(`  settings: FAILED - ${err.message}`);
  }

  // Mark initial sync timestamp
  db.prepare("INSERT OR REPLACE INTO settings (key, value, sync_source) VALUES (?, ?, 'pi')").run(
    "last_sync_at",
    new Date().toISOString()
  );

  db.pragma("foreign_keys = ON");
  db.close();

  console.log(`\nSeed complete. ${totalRows} total rows across ${TABLES_TO_SEED.length} tables + settings.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
