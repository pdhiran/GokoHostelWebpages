-- Accounts (bank/cash accounts)
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'savings',
  account_number TEXT DEFAULT '',
  ifsc_code TEXT DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_accounts_active ON accounts(is_active);

-- Vendors (recurring payment vendors)
CREATE TABLE vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_vendors_category ON vendors(category);

-- Employees (staff for salary tracking)
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  salary INTEGER NOT NULL DEFAULT 0,
  salary_frequency TEXT NOT NULL DEFAULT 'monthly',
  bank_account TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_employees_active ON employees(is_active);

-- Salary payments
CREATE TABLE salary_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  paid_at TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_by TEXT NOT NULL
);
CREATE INDEX idx_salary_employee ON salary_payments(employee_id);
CREATE INDEX idx_salary_month ON salary_payments(month);

-- Daily income entries
CREATE TABLE daily_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  type TEXT NOT NULL DEFAULT 'cash',
  amount INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'stay',
  description TEXT DEFAULT '',
  food_revenue_auto INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_daily_income_date ON daily_income(date);
CREATE INDEX idx_daily_income_account ON daily_income(account_id);

-- Daily ledger (nightly reconciliation per account per day)
CREATE TABLE daily_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  opening_balance INTEGER NOT NULL DEFAULT 0,
  total_income INTEGER NOT NULL DEFAULT 0,
  total_expense INTEGER NOT NULL DEFAULT 0,
  expected_closing INTEGER NOT NULL DEFAULT 0,
  actual_closing INTEGER DEFAULT NULL,
  is_reconciled INTEGER NOT NULL DEFAULT 0,
  reconciled_by TEXT DEFAULT '',
  reconciled_at TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);
CREATE INDEX idx_daily_ledger_date ON daily_ledger(date);
CREATE INDEX idx_daily_ledger_account ON daily_ledger(account_id);

-- Add new columns to existing expenses table
ALTER TABLE expenses ADD COLUMN vendor_id INTEGER DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN account_id INTEGER DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN main_category TEXT DEFAULT 'stay_expense';
ALTER TABLE expenses ADD COLUMN sub_category TEXT DEFAULT '';
