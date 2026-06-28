-- Migration 0031: Booking Calendar Dashboard
-- Adds financial/tracking columns to bookings, bed assignments, booking history, bed blocking

-- 1. New columns on bookings
ALTER TABLE bookings ADD COLUMN amount_before_tax INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN amount_tax INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN amount_total INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN amount_paid INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN nightly_rate INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE bookings ADD COLUMN email TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN cm_booking_id TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN goko_booking_id TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN rate_plan TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN hold_expires_at TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN cancelled_at TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN cancelled_by TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN checked_in_at TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN checked_in_by TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN checked_out_at TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN checked_out_by TEXT DEFAULT '';

-- 2. Migrate existing status values
UPDATE bookings SET status = 'received' WHERE status = 'confirmed';

-- 3. Booking bed assignments
CREATE TABLE IF NOT EXISTS booking_bed_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  bed_id INTEGER NOT NULL REFERENCES beds(id),
  dorm_id INTEGER NOT NULL REFERENCES dorms(id),
  checkin_date TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  assigned_by TEXT DEFAULT '',
  assigned_at TEXT NOT NULL
);
CREATE INDEX idx_bba_bed_dates ON booking_bed_assignments(bed_id, checkin_date, checkout_date);
CREATE INDEX idx_bba_booking ON booking_bed_assignments(booking_id);
CREATE INDEX idx_bba_dates ON booking_bed_assignments(checkin_date, checkout_date);
CREATE INDEX idx_bba_dorm_status_dates ON booking_bed_assignments(dorm_id, status, checkin_date, checkout_date);

-- 4. Booking history
CREATE TABLE IF NOT EXISTS booking_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL
);
CREATE INDEX idx_bh_booking ON booking_history(booking_id);

-- 5. Bed blocking
ALTER TABLE beds ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;

-- 6. Booking lookup indexes
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_goko_id ON bookings(goko_booking_id);
