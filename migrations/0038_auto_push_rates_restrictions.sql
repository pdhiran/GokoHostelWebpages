-- Add auto-push toggles for rates and restrictions
ALTER TABLE channel_config ADD COLUMN auto_push_rates INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channel_config ADD COLUMN auto_push_rate_restrictions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channel_config ADD COLUMN auto_push_inv_restrictions INTEGER NOT NULL DEFAULT 0;
