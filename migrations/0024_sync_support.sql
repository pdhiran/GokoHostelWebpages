-- Sync support: add sync_id, sync_updated_at, sync_source, deleted_at to all syncable tables
-- sync_id: UUID for globally unique row identity across Pi and Cloudflare
-- sync_updated_at: timestamp updated on every write for change detection
-- sync_source: which server last modified the row
-- deleted_at: soft delete timestamp for tombstone sync

-- Core guest & beds
ALTER TABLE checkins ADD COLUMN sync_id TEXT;
ALTER TABLE checkins ADD COLUMN sync_updated_at TEXT;
ALTER TABLE checkins ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE checkins ADD COLUMN deleted_at TEXT;

ALTER TABLE dorms ADD COLUMN sync_id TEXT;
ALTER TABLE dorms ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE dorms ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE dorms ADD COLUMN deleted_at TEXT;

ALTER TABLE beds ADD COLUMN sync_id TEXT;
ALTER TABLE beds ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE beds ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE beds ADD COLUMN deleted_at TEXT;

ALTER TABLE bed_history ADD COLUMN sync_id TEXT;
ALTER TABLE bed_history ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE bed_history ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

ALTER TABLE bookings ADD COLUMN sync_id TEXT;
ALTER TABLE bookings ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE bookings ADD COLUMN deleted_at TEXT;

-- Food ordering
ALTER TABLE menu_categories ADD COLUMN sync_id TEXT;
ALTER TABLE menu_categories ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE menu_categories ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE menu_categories ADD COLUMN deleted_at TEXT;

ALTER TABLE menu_items ADD COLUMN sync_id TEXT;
ALTER TABLE menu_items ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE menu_items ADD COLUMN deleted_at TEXT;

ALTER TABLE food_orders ADD COLUMN sync_id TEXT;
ALTER TABLE food_orders ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE food_orders ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE food_orders ADD COLUMN deleted_at TEXT;

ALTER TABLE food_order_items ADD COLUMN sync_id TEXT;
ALTER TABLE food_order_items ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE food_order_items ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

ALTER TABLE order_modifications ADD COLUMN sync_id TEXT;
ALTER TABLE order_modifications ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE order_modifications ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

-- Financial / accounts
ALTER TABLE accounts ADD COLUMN sync_id TEXT;
ALTER TABLE accounts ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE accounts ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE accounts ADD COLUMN deleted_at TEXT;

ALTER TABLE vendors ADD COLUMN sync_id TEXT;
ALTER TABLE vendors ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE vendors ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE vendors ADD COLUMN deleted_at TEXT;

ALTER TABLE employees ADD COLUMN sync_id TEXT;
ALTER TABLE employees ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE employees ADD COLUMN deleted_at TEXT;

ALTER TABLE salary_payments ADD COLUMN sync_id TEXT;
ALTER TABLE salary_payments ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE salary_payments ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

ALTER TABLE daily_income ADD COLUMN sync_id TEXT;
ALTER TABLE daily_income ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE daily_income ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE daily_income ADD COLUMN deleted_at TEXT;

ALTER TABLE daily_ledger ADD COLUMN sync_id TEXT;
ALTER TABLE daily_ledger ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE daily_ledger ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

ALTER TABLE expenses ADD COLUMN sync_id TEXT;
ALTER TABLE expenses ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE expenses ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE expenses ADD COLUMN deleted_at TEXT;

-- System (synced selectively)
ALTER TABLE users ADD COLUMN sync_id TEXT;
ALTER TABLE users ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';
ALTER TABLE users ADD COLUMN deleted_at TEXT;

ALTER TABLE settings ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

ALTER TABLE qr_history ADD COLUMN sync_id TEXT;
ALTER TABLE qr_history ADD COLUMN sync_updated_at TEXT DEFAULT '';
ALTER TABLE qr_history ADD COLUMN sync_source TEXT DEFAULT 'cloudflare';

-- Tables NOT synced (no sync columns): api_stats, system_logs, rate_scrapes, push_subscriptions, audit_log

-- ==============================
-- Sync infrastructure tables
-- ==============================

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,  -- 'pull', 'push', 'full'
  status TEXT NOT NULL DEFAULT 'started',  -- 'started', 'completed', 'failed', 'partial'
  records_pulled INTEGER NOT NULL DEFAULT 0,
  records_pushed INTEGER NOT NULL DEFAULT 0,
  conflicts_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT DEFAULT '',
  details TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  sync_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL DEFAULT 'update_update',  -- 'update_update', 'update_delete', 'unique_violation', 'fk_missing'
  cloud_data TEXT NOT NULL DEFAULT '{}',
  pi_data TEXT NOT NULL DEFAULT '{}',
  cloud_updated_at TEXT DEFAULT '',
  pi_updated_at TEXT DEFAULT '',
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution TEXT DEFAULT '',  -- 'cloud', 'pi', 'manual', 'merged'
  resolved_at TEXT DEFAULT '',
  resolved_by TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON sync_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_table ON sync_conflicts(table_name);

CREATE TABLE IF NOT EXISTS sync_id_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  sync_id TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  remote_id INTEGER,
  UNIQUE(table_name, sync_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_id_map_lookup ON sync_id_map(table_name, local_id);
