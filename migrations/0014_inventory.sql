ALTER TABLE menu_items ADD COLUMN track_inventory INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE menu_categories ADD COLUMN track_inventory_default INTEGER NOT NULL DEFAULT 0;

-- New category: Beverages & Packaged
INSERT INTO menu_categories (name, name_kannada, icon, description, display_order, is_active, track_inventory_default) 
VALUES ('Beverages & Packaged', 'ಪಾನೀಯ & ಪ್ಯಾಕೇಜ್ಡ್', '🍺', 'Bottled drinks and packaged items', 15, 1, 1);

-- Seed common items (get the category ID dynamically)
-- Use INSERT with subquery for category_id
INSERT INTO menu_items (category_id, name, name_kannada, description, price, tags, ingredients, is_available, display_order, track_inventory, stock_quantity, low_stock_threshold)
VALUES 
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Water Bottle (500ml)', 'ನೀರಿನ ಬಾಟಲಿ', 'Packaged drinking water', 2000, '["veg"]', '[]', 1, 1, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Water Bottle (1L)', 'ನೀರಿನ ಬಾಟಲಿ (1L)', 'Packaged drinking water', 4000, '["veg"]', '[]', 1, 2, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Coca-Cola', 'ಕೋಕಾ-ಕೋಲಾ', 'Chilled Coca-Cola', 4000, '["veg"]', '[]', 1, 3, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Sprite', 'ಸ್ಪ್ರೈಟ್', 'Chilled Sprite', 4000, '["veg"]', '[]', 1, 4, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Fanta', 'ಫ್ಯಾಂಟಾ', 'Chilled Fanta', 4000, '["veg"]', '[]', 1, 5, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Thumbs Up', 'ಥಮ್ಸ್ ಅಪ್', 'Chilled Thumbs Up', 4000, '["veg"]', '[]', 1, 6, 1, 0, 5),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Kingfisher Beer', 'ಕಿಂಗ್‌ಫಿಶರ್ ಬಿಯರ್', 'Kingfisher Premium', 15000, '["veg"]', '[]', 1, 7, 1, 0, 3),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Bira White', 'ಬಿರಾ ವೈಟ್', 'Bira 91 White', 18000, '["veg"]', '[]', 1, 8, 1, 0, 3),
((SELECT id FROM menu_categories WHERE name = 'Beverages & Packaged'), 'Bira Blonde', 'ಬಿರಾ ಬ್ಲಾಂಡ್', 'Bira 91 Blonde', 18000, '["veg"]', '[]', 1, 9, 1, 0, 3);
