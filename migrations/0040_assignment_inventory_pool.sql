-- Tag each assigned bed as online (OTA/PMS), offline (walk-in), or block (took a blocked bed).
-- Existing rows default to online so previously pushed Aiosell counts stay unchanged.
ALTER TABLE booking_bed_assignments ADD COLUMN inventory_pool TEXT NOT NULL DEFAULT 'online';
