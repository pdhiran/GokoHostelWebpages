-- HTTP metadata on channel_sync_log for PMS debugger (Management → Logs → PMS)

ALTER TABLE channel_sync_log ADD COLUMN http_method TEXT DEFAULT '';
ALTER TABLE channel_sync_log ADD COLUMN url TEXT DEFAULT '';
ALTER TABLE channel_sync_log ADD COLUMN http_status INTEGER;
ALTER TABLE channel_sync_log ADD COLUMN duration_ms INTEGER;
