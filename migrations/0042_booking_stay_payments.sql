-- Stay collect method (Cash/Online/Split) and cancel refunds. Pi applies this file.
ALTER TABLE bookings ADD COLUMN payment_method TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN cash_received INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN change_given INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN amount_refunded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN refund_method TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN refund_cash INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN refunded_at TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN refunded_by TEXT NOT NULL DEFAULT '';
