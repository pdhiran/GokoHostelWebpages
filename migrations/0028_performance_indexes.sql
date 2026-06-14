-- Phone lookup index for food order bills/status
CREATE INDEX IF NOT EXISTS idx_food_orders_guest_phone ON food_orders(guest_phone);

-- Sync pull indexes (sync_updated_at) for all synced tables
CREATE INDEX IF NOT EXISTS idx_checkins_sync_updated ON checkins(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_dorms_sync_updated ON dorms(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_beds_sync_updated ON beds(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_bookings_sync_updated ON bookings(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sync_updated ON menu_categories(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_sync_updated ON menu_items(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_food_orders_sync_updated ON food_orders(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_accounts_sync_updated ON accounts(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_vendors_sync_updated ON vendors(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_employees_sync_updated ON employees(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_sync_updated ON expenses(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_income_sync_updated ON daily_income(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_users_sync_updated ON users(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_bed_history_sync_updated ON bed_history(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_food_order_items_sync_updated ON food_order_items(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_order_modifications_sync_updated ON order_modifications(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_salary_payments_sync_updated ON salary_payments(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_ledger_sync_updated ON daily_ledger(sync_updated_at);
CREATE INDEX IF NOT EXISTS idx_qr_history_sync_updated ON qr_history(sync_updated_at);
