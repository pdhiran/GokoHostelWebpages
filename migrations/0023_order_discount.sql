ALTER TABLE food_orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE food_orders ADD COLUMN discount_reason TEXT DEFAULT '';
ALTER TABLE food_orders ADD COLUMN discount_by TEXT DEFAULT '';
