-- Review Funnel tables
CREATE TABLE IF NOT EXISTS review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  checkin_id INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  guest_contact TEXT NOT NULL,
  property_id TEXT DEFAULT 'goko_hostel',
  booking_id TEXT DEFAULT '',
  whatsapp_sent_count INTEGER DEFAULT 0,
  whatsapp_last_sent_at TEXT,
  rating INTEGER,
  rated_at TEXT,
  redirected_to_google INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT,
  sync_source TEXT DEFAULT 'cloudflare',
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_requests_checkin ON review_requests(checkin_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_created ON review_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_review_requests_property ON review_requests(property_id);

CREATE TABLE IF NOT EXISTS review_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_request_id INTEGER NOT NULL REFERENCES review_requests(id),
  rating INTEGER NOT NULL,
  improvement_areas TEXT NOT NULL DEFAULT '[]',
  comments TEXT DEFAULT '',
  submitted_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT,
  sync_source TEXT DEFAULT 'cloudflare',
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_feedback_request ON review_feedback(review_request_id);
CREATE INDEX IF NOT EXISTS idx_review_feedback_submitted ON review_feedback(submitted_at);

-- Default settings for review funnel
INSERT OR IGNORE INTO settings (key, value) VALUES ('review_google_url', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('review_send_delay', 'immediate');
INSERT OR IGNORE INTO settings (key, value) VALUES ('review_whatsapp_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('review_message_template', 'Thank you for staying with us! ❤️\n\nHow was your experience? Please rate your stay:\n{REVIEW_URL}');
