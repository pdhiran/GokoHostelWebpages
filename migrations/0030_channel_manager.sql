-- Channel Manager integration (Aiosell)

CREATE TABLE IF NOT EXISTS channel_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'aiosell',
  hotel_code TEXT NOT NULL,
  pms_id TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  api_username TEXT NOT NULL,
  api_password TEXT NOT NULL,
  webhook_secret TEXT DEFAULT '',
  booking_engine_url TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_type_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dorm_id INTEGER NOT NULL REFERENCES dorms(id),
  dorm_name TEXT NOT NULL,
  channel_room_code TEXT NOT NULL,
  total_inventory INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rate_plan_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_mapping_id INTEGER NOT NULL REFERENCES room_type_mapping(id),
  rate_plan_code TEXT NOT NULL,
  rate_plan_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS daily_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_plan_id INTEGER NOT NULL REFERENCES rate_plan_mapping(id),
  date TEXT NOT NULL,
  rate INTEGER NOT NULL,
  stop_sell INTEGER NOT NULL DEFAULT 0,
  minimum_stay INTEGER NOT NULL DEFAULT 1,
  maximum_stay INTEGER,
  close_on_arrival INTEGER NOT NULL DEFAULT 0,
  close_on_departure INTEGER NOT NULL DEFAULT 0,
  minimum_advance_reservation INTEGER,
  maximum_advance_reservation INTEGER,
  updated_by TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  synced_at TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_rates_plan_date ON daily_rates(rate_plan_id, date);

CREATE TABLE IF NOT EXISTS channel_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_payload TEXT DEFAULT '',
  response_payload TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  records_affected INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_sync_created ON channel_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_channel_sync_type ON channel_sync_log(type);
