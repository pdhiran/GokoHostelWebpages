CREATE TABLE qr_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  preview_data_url TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_qr_history_created ON qr_history(created_at);
