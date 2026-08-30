-- Staff/volunteer Splitwise (Cloudflare-only; Pi migrator skips this file)

CREATE TABLE IF NOT EXISTS split_members (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'staff',
  user_id integer,
  employee_id integer,
  is_house integer NOT NULL DEFAULT 0,
  is_active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_members_user ON split_members (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_members_house ON split_members (is_house) WHERE is_house = 1;
CREATE INDEX IF NOT EXISTS idx_split_members_active ON split_members (is_active);

CREATE TABLE IF NOT EXISTS split_groups (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  created_by text NOT NULL DEFAULT '',
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS split_group_members (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id integer NOT NULL,
  member_id integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_group_members_unique ON split_group_members (group_id, member_id);
CREATE INDEX IF NOT EXISTS idx_split_group_members_group ON split_group_members (group_id);

CREATE TABLE IF NOT EXISTS split_expenses (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id integer NOT NULL,
  description text NOT NULL,
  total_amount integer NOT NULL,
  expense_date text NOT NULL,
  split_method text NOT NULL DEFAULT 'equal',
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  hostel_expense_id integer,
  deleted_at text
);
CREATE INDEX IF NOT EXISTS idx_split_expenses_group_date ON split_expenses (group_id, expense_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_expenses_hostel ON split_expenses (hostel_expense_id) WHERE hostel_expense_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS split_expense_shares (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  expense_id integer NOT NULL,
  member_id integer NOT NULL,
  paid_amount integer NOT NULL DEFAULT 0,
  owed_amount integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_expense_shares_unique ON split_expense_shares (expense_id, member_id);
CREATE INDEX IF NOT EXISTS idx_split_expense_shares_expense ON split_expense_shares (expense_id);

CREATE TABLE IF NOT EXISTS split_settlements (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  group_id integer NOT NULL,
  from_member_id integer NOT NULL,
  to_member_id integer NOT NULL,
  amount integer NOT NULL,
  method text NOT NULL DEFAULT 'other',
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  hostel_expense_id integer,
  split_expense_id integer,
  deleted_at text
);
CREATE INDEX IF NOT EXISTS idx_split_settlements_group ON split_settlements (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_settlements_hostel ON split_settlements (hostel_expense_id) WHERE hostel_expense_id IS NOT NULL;

INSERT INTO split_members (name, kind, is_house, is_active, created_at)
VALUES ('Goko', 'house', 1, 1, '2026-08-30T00:00:00.000Z');
