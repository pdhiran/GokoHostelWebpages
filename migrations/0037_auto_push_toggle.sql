-- Add auto-push toggle to channel_config (default ON for existing setups)
ALTER TABLE channel_config ADD COLUMN auto_push_inventory INTEGER NOT NULL DEFAULT 1;
