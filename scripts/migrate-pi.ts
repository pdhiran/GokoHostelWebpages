import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.SQLITE_PATH || "./goko.db";
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const applied = new Set(
  db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name)
);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;

  const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
  console.log(`Applying: ${file}`);

  const transaction = db.transaction(() => {
    db.exec(sqlContent);
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  });

  try {
    transaction();
    count++;
    console.log(`  Applied successfully`);
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }
}

if (count === 0) {
  console.log("All migrations already applied.");
} else {
  console.log(`\nApplied ${count} migration(s).`);
}

db.close();
