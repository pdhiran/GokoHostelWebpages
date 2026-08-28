-- Track which dorm+date combos have unsync'd inventory changes
CREATE TABLE IF NOT EXISTS inventory_dirty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dorm_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_dirty_dorm_date ON inventory_dirty(dorm_id, date);
