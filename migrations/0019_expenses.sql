CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  custom_category TEXT DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  bill_image_link TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  updated_by TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT DEFAULT '',
  created_month TEXT NOT NULL
);
CREATE INDEX idx_expenses_month ON expenses(created_month);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
