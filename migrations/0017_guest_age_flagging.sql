-- Add DOB and vibe_matched columns for guest age flagging
ALTER TABLE checkins ADD COLUMN dob TEXT DEFAULT '';
ALTER TABLE checkins ADD COLUMN vibe_matched INTEGER DEFAULT 0;

-- Seed default age range settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('guest_min_age', '18');
INSERT OR IGNORE INTO settings (key, value) VALUES ('guest_max_age', '40');
