ALTER TABLE employees ADD COLUMN attendance_start_date TEXT NOT NULL DEFAULT '';
ALTER TABLE employees ADD COLUMN employment_end_date TEXT NOT NULL DEFAULT '';
UPDATE employees SET attendance_start_date = '2026-09-01' WHERE attendance_start_date = '';

ALTER TABLE salary_payments ADD COLUMN pay_type TEXT NOT NULL DEFAULT 'salary';
ALTER TABLE salary_payments ADD COLUMN request_id TEXT NOT NULL DEFAULT '';
ALTER TABLE salary_payments ADD COLUMN gross_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salary_payments ADD COLUMN attendance_deduction INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salary_payments ADD COLUMN net_payable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salary_payments ADD COLUMN paid_leave_units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salary_payments ADD COLUMN unpaid_leave_units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE salary_payments ADD COLUMN calculation_snapshot TEXT NOT NULL DEFAULT '';
UPDATE salary_payments SET pay_type = CASE
  WHEN notes LIKE '[Bonus]%' THEN 'bonus'
  WHEN notes LIKE '[Advance]%' THEN 'advance'
  WHEN notes LIKE '[Loan]%' THEN 'loan'
  WHEN notes LIKE '[Reimbursement]%' THEN 'reimbursement'
  ELSE 'salary' END;
CREATE UNIQUE INDEX idx_salary_request_id ON salary_payments(request_id) WHERE request_id != '';

CREATE TABLE employee_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  comment TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT DEFAULT '',
  sync_source TEXT DEFAULT 'cloudflare',
  deleted_at TEXT
);
CREATE UNIQUE INDEX idx_employee_attendance_day ON employee_attendance(employee_id, date);
CREATE INDEX idx_employee_attendance_date ON employee_attendance(date);

CREATE TABLE employee_attendance_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  old_status TEXT NOT NULL DEFAULT 'present',
  new_status TEXT NOT NULL,
  old_comment TEXT NOT NULL DEFAULT '',
  new_comment TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT DEFAULT '',
  sync_source TEXT DEFAULT 'cloudflare'
);
CREATE INDEX idx_employee_attendance_history_employee ON employee_attendance_history(employee_id);
CREATE INDEX idx_employee_attendance_history_date ON employee_attendance_history(date);

CREATE TABLE employee_leave_policy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER REFERENCES employees(id),
  effective_month TEXT NOT NULL,
  monthly_credit_units INTEGER NOT NULL DEFAULT 4,
  carry_cap_units INTEGER NOT NULL DEFAULT 24,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT DEFAULT '',
  sync_source TEXT DEFAULT 'cloudflare',
  deleted_at TEXT
);
CREATE INDEX idx_employee_leave_policy_month ON employee_leave_policy(effective_month);
CREATE INDEX idx_employee_leave_policy_employee ON employee_leave_policy(employee_id);
CREATE UNIQUE INDEX idx_employee_leave_policy_unique ON employee_leave_policy(COALESCE(employee_id, 0), effective_month);

CREATE TABLE employee_compensation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  effective_month TEXT NOT NULL,
  salary INTEGER NOT NULL,
  salary_frequency TEXT NOT NULL DEFAULT 'monthly',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sync_id TEXT,
  sync_updated_at TEXT DEFAULT '',
  sync_source TEXT DEFAULT 'cloudflare',
  deleted_at TEXT
);
CREATE UNIQUE INDEX idx_employee_comp_month ON employee_compensation_history(employee_id, effective_month);

INSERT INTO employee_leave_policy (employee_id, effective_month, monthly_credit_units, carry_cap_units, created_by, created_at)
VALUES (NULL, '2026-09', 4, 24, 'migration', '2026-09-01T00:00:00.000Z');
INSERT INTO employee_compensation_history (employee_id, effective_month, salary, salary_frequency, created_by, created_at)
SELECT id, '2026-09', salary, salary_frequency, 'migration', '2026-09-01T00:00:00.000Z' FROM employees;

UPDATE users SET permissions = json_set(COALESCE(NULLIF(permissions, ''), '{}'), '$.canManageAttendance', 1) WHERE role = 'manager';
