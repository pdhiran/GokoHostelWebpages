-- Persistent Aiosell no-show delivery state for retry-safe Booking.com updates.
ALTER TABLE bookings ADD COLUMN no_show_pms_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE bookings ADD COLUMN no_show_pms_error TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN no_show_pms_attempted_at TEXT NOT NULL DEFAULT '';
