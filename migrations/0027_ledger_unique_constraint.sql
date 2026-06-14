-- Remove duplicate daily_ledger rows (keep the most recent one per date+account)
DELETE FROM daily_ledger
WHERE id NOT IN (
  SELECT MAX(id) FROM daily_ledger GROUP BY date, account_id
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_ledger_date_account_unique
ON daily_ledger(date, account_id);
