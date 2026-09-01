-- Automatic online food/stay receipt journal. Pi applies this file.
CREATE TABLE IF NOT EXISTS guest_receipts (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  receipt_id text NOT NULL UNIQUE,
  source_type text NOT NULL,
  source_id integer NOT NULL,
  kind text NOT NULL,
  account_id integer NOT NULL,
  amount integer NOT NULL,
  business_date text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  sync_id text,
  sync_updated_at text,
  sync_source text DEFAULT 'cloudflare'
);
CREATE INDEX IF NOT EXISTS idx_guest_receipts_date_account ON guest_receipts (business_date, account_id);
CREATE INDEX IF NOT EXISTS idx_guest_receipts_source ON guest_receipts (source_type, source_id);
