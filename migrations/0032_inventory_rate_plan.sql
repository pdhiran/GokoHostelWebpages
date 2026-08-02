-- Migration 0032: Inventory & Rate Plan Management
-- Adds tables for bed-type config, channels, channel-level rates, date-aware bed blocking, and inventory overrides.
-- Adds per-occupancy rate columns to daily_rates.

-- 1. Bed Type Configuration (occupancy rules per dorm/bed-type)
CREATE TABLE IF NOT EXISTS bed_type_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dorm_id INTEGER NOT NULL REFERENCES dorms(id),
  bed_type TEXT NOT NULL DEFAULT 'Bunk',
  max_occupancy INTEGER NOT NULL DEFAULT 1,
  extra_person_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bed_type_config_dorm ON bed_type_config(dorm_id);

-- 2. Sales Channels
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default channels
INSERT OR IGNORE INTO channels (name, code) VALUES
  ('Walk-in', 'walkin'),
  ('Booking.com', 'booking_com'),
  ('Hostelworld', 'hostelworld'),
  ('MakeMyTrip', 'makemytrip'),
  ('Goibibo', 'goibibo'),
  ('Website', 'website'),
  ('Direct', 'direct');

-- 3. Channel-Level Rate Overrides
CREATE TABLE IF NOT EXISTS channel_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_plan_id INTEGER NOT NULL REFERENCES rate_plan_mapping(id),
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  date TEXT NOT NULL,
  adult1_rate INTEGER,
  adult2_rate INTEGER,
  child_rate INTEGER,
  infant_rate INTEGER,
  extra_person_rate INTEGER,
  updated_by TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_channel_rates_plan_channel_date ON channel_rates(rate_plan_id, channel_id, date);

-- 4. Date-Range Bed Blocking
CREATE TABLE IF NOT EXISTS bed_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bed_id INTEGER NOT NULL REFERENCES beds(id),
  dorm_id INTEGER NOT NULL REFERENCES dorms(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT DEFAULT '',
  blocked_by TEXT DEFAULT '',
  blocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  unblocked_by TEXT,
  unblocked_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_bed_blocks_dorm_dates ON bed_blocks(dorm_id, start_date, end_date, is_active);
CREATE INDEX idx_bed_blocks_bed ON bed_blocks(bed_id, is_active);

-- 5. Manual Inventory Overrides
CREATE TABLE IF NOT EXISTS inventory_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dorm_id INTEGER NOT NULL REFERENCES dorms(id),
  channel_id INTEGER REFERENCES channels(id),
  date TEXT NOT NULL,
  online_available INTEGER,
  offline_available INTEGER,
  overridden_by TEXT DEFAULT '',
  overridden_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_inventory_overrides_dorm_channel_date ON inventory_overrides(dorm_id, channel_id, date);

-- 6. Add per-occupancy rate columns to daily_rates (all nullable, no impact on existing rows)
ALTER TABLE daily_rates ADD COLUMN adult1_rate INTEGER;
ALTER TABLE daily_rates ADD COLUMN adult2_rate INTEGER;
ALTER TABLE daily_rates ADD COLUMN child_rate INTEGER;
ALTER TABLE daily_rates ADD COLUMN infant_rate INTEGER;
ALTER TABLE daily_rates ADD COLUMN extra_person_rate INTEGER;
