-- Migration 0011: Fix idempotency index, add item status, fix chicken wings price

-- Fix idempotency_key: allow NULL (multiple orders without client UUID)
DROP INDEX IF EXISTS idx_food_orders_idempotency;
CREATE UNIQUE INDEX idx_food_orders_idempotency ON food_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add status field to food_order_items for item-level voiding
ALTER TABLE food_order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Fix Chicken Wings price (should be lower of ₹280/270 = ₹270 = 27000 paise)
UPDATE menu_items SET price = 27000 WHERE name = 'Chicken Wings (Buffalo/ Peri-peri)' AND category_id = 5;
