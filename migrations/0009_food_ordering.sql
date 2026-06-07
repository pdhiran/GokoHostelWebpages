-- Migration 0009: Food ordering system
-- Adds menu management, food orders, order items, and order modifications

-- Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🍽️',
  description TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  price_text TEXT DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  ingredients TEXT NOT NULL DEFAULT '[]',
  image_url TEXT DEFAULT '',
  is_available INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- Food orders
CREATE TABLE IF NOT EXISTS food_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT DEFAULT NULL,
  guest_type TEXT NOT NULL DEFAULT 'walkin',
  checkin_id INTEGER REFERENCES checkins(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL DEFAULT '',
  room_info TEXT DEFAULT '',
  table_number TEXT DEFAULT '',
  special_instructions TEXT DEFAULT '',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'placed',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT '',
  paid_by TEXT DEFAULT '',
  cancelled_reason TEXT DEFAULT '',
  cancelled_at TEXT DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'guest',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_orders_checkin ON food_orders(checkin_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders(status);
CREATE INDEX IF NOT EXISTS idx_food_orders_payment ON food_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_food_orders_created ON food_orders(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_orders_idempotency ON food_orders(idempotency_key);

-- Food order items
CREATE TABLE IF NOT EXISTS food_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES food_orders(id),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  item_price INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_food_order_items_order ON food_order_items(order_id);

-- Order modifications (void, discount, cancel, reassign audit trail)
CREATE TABLE IF NOT EXISTS order_modifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES food_orders(id),
  action TEXT NOT NULL,
  item_id INTEGER,
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  modified_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_mods_order ON order_modifications(order_id);

-- Default food settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_kitchen_whatsapp', '919483788886');
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_tax_rate', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_kitchen_open', '07:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_kitchen_close', '22:00');
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_kitchen_busy', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('food_tab_limit', '0');


-- Seed menu categories
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('All-Day Breakfast', '🍳', 'Breakfast served all day', 1, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Hot Beverages', '☕', 'Fresh hot drinks', 2, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Cold Beverages', '🥤', 'Refreshing cold drinks', 3, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Sandwiches', '🥪', 'Served with chips', 4, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Appetizers', '🍟', 'Starters and snacks', 5, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Bowls', '🍲', 'Hearty bowl meals', 6, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Salads', '🥗', 'Fresh healthy salads', 7, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Pizza', '🍕', 'Wood-fired pizzas', 8, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Pasta', '🍝', 'Penne/Spaghetti/Fusilli - Veg/Non Veg', 9, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Steak', '🥩', 'Served with Mashed Potatoes, Stir-fry Veggies & Gravy', 10, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Chinese', '🥡', 'Indo-Chinese favorites', 11, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Indian Mains', '🍛', 'Traditional Indian curries', 12, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Breads', '🥖', 'Fresh Indian breads', 13, 1);
INSERT INTO menu_categories (name, icon, description, display_order, is_active) VALUES ('Rice', '🍚', 'Rice preparations', 14, 1);

-- Seed menu items
-- All-Day Breakfast
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Omelette', 'Classic fluffy omelette', 8000, '', '["veg"]', '["Eggs","Butter","Salt","Pepper"]', 'images/butter-naan.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Masala Omelette', 'Spiced Indian-style omelette', 11000, '', '["veg"]', '["Eggs","Onions","Tomatoes","Green chili","Spices"]', 'images/garlic-naan.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Scrambled Eggs', 'Soft scrambled eggs', 8000, '', '["veg"]', '["Eggs","Butter","Milk","Salt","Pepper"]', 'images/tandoori-roti.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Sunny-side Up', 'Perfectly fried sunny-side up eggs', 10000, '', '["veg"]', '["Eggs","Butter","Salt","Pepper"]', 'images/cheese-naan.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Boiled Eggs', 'Perfectly boiled eggs', 7000, '', '["veg"]', '["Eggs"]', 'images/kashmiri-naan.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Toast', 'Crispy toasted bread', 3000, '', '["veg"]', '["Bread","Butter"]', 'images/butter-naan.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Maggi', 'Classic instant noodles', 8000, '', '["veg"]', '["Maggi noodles","Masala","Vegetables"]', 'images/fried-rice.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Cheese Maggi', 'Maggi with cheese topping', 12000, '', '["veg"]', '["Maggi noodles","Cheese","Masala"]', 'images/fried-rice.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Veg. Maggi', 'Maggi with vegetables', 10000, '', '["veg"]', '["Maggi noodles","Mixed vegetables","Masala"]', 'images/fried-rice.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Egg Maggi', 'Maggi with egg', 15000, '', '["veg"]', '["Maggi noodles","Egg","Masala"]', 'images/egg-fried-rice.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Chicken Maggi', 'Maggi with chicken', 16000, '', '["non-veg"]', '["Maggi noodles","Chicken","Masala"]', 'images/chicken-biryani.jpg', 1, 11);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Poori Bhaji', 'Fluffy pooris with potato curry', 15000, '', '["veg"]', '["Whole wheat flour","Potatoes","Spices"]', 'images/tandoori-roti.jpg', 1, 12);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Chole Bhature', 'Fluffy bhature with chickpea curry', 17000, '', '["veg"]', '["All-purpose flour","Chickpeas","Spices"]', 'images/chana-masala.jpg', 1, 13);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Aloo Paratha', 'Potato stuffed flatbread', 12000, '', '["veg"]', '["Wheat flour","Potatoes","Spices","Butter"]', 'images/tandoori-roti.jpg', 1, 14);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Gobi Paratha', 'Cauliflower stuffed flatbread', 13000, '', '["veg"]', '["Wheat flour","Cauliflower","Spices","Butter"]', 'images/tandoori-roti.jpg', 1, 15);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Paneer Paratha', 'Cottage cheese stuffed flatbread', 17000, '', '["veg"]', '["Wheat flour","Paneer","Spices","Butter"]', 'images/paneer-tikka.jpg', 1, 16);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Mix Paratha', 'Mixed vegetable stuffed flatbread', 16000, '', '["veg"]', '["Wheat flour","Mixed vegetables","Spices","Butter"]', 'images/tandoori-roti.jpg', 1, 17);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Honey Crepes', 'Sweet crepes with honey', 15000, '', '["veg"]', '["Flour","Milk","Eggs","Honey"]', 'images/chocolate-brownie.jpg', 1, 18);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Banana Crepes', 'Crepes with banana filling', 16000, '', '["veg"]', '["Flour","Milk","Eggs","Banana"]', 'images/chocolate-brownie.jpg', 1, 19);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (1, 'Nutella Crepes', 'Crepes with Nutella spread', 20000, '', '["veg"]', '["Flour","Milk","Eggs","Nutella"]', 'images/chocolate-brownie.jpg', 1, 20);

-- Hot Beverages
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Ginger Tea', 'Refreshing ginger-infused tea', 4000, '', '["veg"]', '["Tea","Ginger","Sugar","Milk"]', 'images/masala-chai.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Masala Tea', 'Spiced Indian tea', 5000, '', '["veg"]', '["Tea","Spices","Sugar","Milk"]', 'images/masala-chai.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Black Tea', 'Simple black tea', 2000, '', '["veg"]', '["Tea","Sugar"]', 'images/masala-chai.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Green Tea', 'Healthy green tea', 4000, '', '["veg"]', '["Green tea"]', 'images/masala-chai.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Honey Ginger Lemon Tea', 'Soothing honey ginger lemon tea', 4000, '', '["veg"]', '["Tea","Honey","Ginger","Lemon"]', 'images/masala-chai.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Milk Tea', 'Classic milk tea', 3000, '', '["veg"]', '["Tea","Milk","Sugar"]', 'images/masala-chai.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Milk Coffee', 'Hot milk coffee', 4000, '', '["veg"]', '["Coffee","Milk","Sugar"]', 'images/cold-coffee.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Hazelnut Coffee', 'Coffee with hazelnut flavor', 6000, '', '["veg"]', '["Coffee","Hazelnut","Milk","Sugar"]', 'images/cold-coffee.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Vanilla Coffee', 'Coffee with vanilla flavor', 6000, '', '["veg"]', '["Coffee","Vanilla","Milk","Sugar"]', 'images/cold-coffee.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Hot Chocolate', 'Rich hot chocolate', 8000, '', '["veg"]', '["Chocolate","Milk","Sugar"]', 'images/chocolate-brownie.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Bournvita', 'Hot Bournvita drink', 5000, '', '["veg"]', '["Bournvita","Milk","Sugar"]', 'images/cold-coffee.jpg', 1, 11);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (2, 'Milk', 'Hot or cold milk', 4000, '', '["veg"]', '["Milk"]', 'images/mango-lassi.jpg', 1, 12);

-- Cold Beverages
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Cold Coffee', 'Chilled coffee with milk and ice cream', 15000, '', '["veg"]', '["Coffee","Milk","Ice cream","Sugar"]', 'images/cold-coffee.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Oreo Milkshake', 'Creamy Oreo milkshake', 17000, '', '["veg"]', '["Oreo cookies","Milk","Ice cream","Sugar"]', 'images/ice-cream.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'KitKat Milkshake', 'Chocolate KitKat milkshake', 16000, '', '["veg"]', '["KitKat","Milk","Ice cream","Sugar"]', 'images/ice-cream.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Brownie Milkshake', 'Rich brownie milkshake', 19000, '', '["veg"]', '["Brownie","Milk","Ice cream","Sugar"]', 'images/chocolate-brownie.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Iced Tea', 'Refreshing iced tea', 15000, '', '["veg"]', '["Tea","Ice","Lemon","Sugar"]', 'images/fresh-lime-soda.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Fresh Lime Water/ Soda', 'Fresh lime with water or soda', 5000, '₹50/70', '["veg"]', '["Lime","Water/Soda","Sugar","Salt"]', 'images/fresh-lime-soda.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Watermelon/ Orange/ Pineapple Juice', 'Fresh fruit juice', 12000, '', '["veg"]', '["Fresh fruit","Sugar"]', 'images/mango-lassi.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Kokam Sharbat', 'Traditional kokam drink', 7000, '', '["veg"]', '["Kokam","Sugar","Spices"]', 'images/sweet-lassi.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Roohafza Shake', 'Rose-flavored milkshake', 20000, '', '["veg"]', '["Roohafza","Milk","Ice cream"]', 'images/sweet-lassi.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Chocolate Shake', 'Classic chocolate milkshake', 15000, '', '["veg"]', '["Chocolate","Milk","Ice cream"]', 'images/ice-cream.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (3, 'Aerated Bottled Beverages', 'Soft drinks', 0, 'MRP', '["veg"]', '["Carbonated beverage"]', 'images/fresh-lime-soda.jpg', 0, 11);

-- Sandwiches
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Veg. Club', 'Classic vegetable club sandwich', 20000, '', '["veg"]', '["Bread","Vegetables","Cheese","Mayo","Chips"]', 'images/spring-rolls.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Veg. Cheese', 'Grilled vegetable cheese sandwich', 17000, '', '["veg"]', '["Bread","Vegetables","Cheese","Butter","Chips"]', 'images/cheese-naan.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Paneer Bhurji', 'Scrambled paneer sandwich', 20000, '', '["veg"]', '["Bread","Paneer","Spices","Butter","Chips"]', 'images/paneer-butter-masala.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Bombay', 'Spiced Bombay-style sandwich', 17000, '', '["veg"]', '["Bread","Potato","Chutneys","Spices","Chips"]', 'images/chana-masala.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Corn & Cheese S/w', 'Sweet corn and cheese sandwich', 20000, '', '["veg"]', '["Bread","Corn","Cheese","Mayo","Chips"]', 'images/cheese-naan.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Potato Sandwich', 'Spiced potato sandwich', 15000, '', '["veg"]', '["Bread","Potato","Spices","Butter","Chips"]', 'images/tandoori-roti.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Peri-peri Chicken', 'Spicy peri-peri chicken sandwich', 24000, '', '["non-veg","spicy"]', '["Bread","Chicken","Peri-peri sauce","Vegetables","Chips"]', 'images/chicken-tikka.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Tandoori Chicken', 'Tandoori chicken sandwich', 24000, '', '["non-veg"]', '["Bread","Tandoori chicken","Mint chutney","Vegetables","Chips"]', 'images/chicken-tikka.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (4, 'Tuna', 'Tuna fish sandwich', 28000, '', '["non-veg"]', '["Bread","Tuna","Mayo","Vegetables","Chips"]', 'images/fish-tikka.jpg', 1, 9);

-- Appetizers
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Crispy Corn', 'Crispy fried corn kernels', 15000, '', '["veg"]', '["Corn","Spices","Flour"]', 'images/vegetable-samosa.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Corn Chat', 'Spicy corn chat', 14000, '', '["veg"]', '["Corn","Onions","Spices","Lemon"]', 'images/vegetable-samosa.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'French Fries (Salted/ Peri-peri)', 'Crispy French fries', 15000, '₹150/160', '["veg"]', '["Potatoes","Salt/Peri-peri"]', 'images/spring-rolls.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chicken Wings (Buffalo/ Peri-peri)', 'Spicy chicken wings', 28000, '₹280/270', '["non-veg","spicy"]', '["Chicken wings","Spices","Sauce"]', 'images/chicken-wings.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Goko Special Fiery Wings', 'Extra spicy signature wings', 30000, '', '["non-veg","spicy"]', '["Chicken wings","Special spicy sauce"]', 'images/chicken-wings.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Cheese Jalapeño Poppers', 'Cheese-stuffed jalapeño poppers', 25000, '', '["veg","spicy"]', '["Jalapeños","Cheese","Breadcrumbs"]', 'images/cheese-naan.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Cheese Garlic Toast', 'Garlic bread with cheese', 18000, '', '["veg"]', '["Bread","Garlic","Cheese","Butter"]', 'images/cheese-garlic-naan.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Crispy Chilli Babycorn', 'Spicy crispy babycorn', 24000, '', '["veg","spicy"]', '["Babycorn","Chilies","Sauces","Spices"]', 'images/vegetable-samosa.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Honey Chilli Potato', 'Sweet and spicy potato', 20000, '', '["veg"]', '["Potatoes","Honey","Chilies","Sauces"]', 'images/spring-rolls.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Gobi Manchurian', 'Indo-Chinese cauliflower', 18000, '', '["veg"]', '["Cauliflower","Sauces","Spices"]', 'images/hara-bhara-kabab.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chilli Paneer', 'Spicy paneer in chili sauce', 22000, '', '["veg","spicy"]', '["Paneer","Bell peppers","Chilies","Sauces"]', 'images/paneer-tikka.jpg', 1, 11);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Deviled Eggs', 'Stuffed boiled eggs', 20000, '', '["veg"]', '["Eggs","Mayo","Spices"]', 'images/egg-fried-rice.jpg', 1, 12);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chicken Popcorn', 'Bite-sized crispy chicken', 24000, '', '["non-veg"]', '["Chicken","Breadcrumbs","Spices"]', 'images/chicken-tikka.jpg', 1, 13);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chilli Chicken', 'Spicy chicken in chili sauce', 24000, '', '["non-veg","spicy"]', '["Chicken","Bell peppers","Chilies","Sauces"]', 'images/kadai-chicken.jpg', 1, 14);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Butter Garlic Prawn', 'Prawns in butter garlic sauce', 0, 'SP', '["non-veg"]', '["Prawns","Butter","Garlic","Spices"]', 'images/fish-tikka.jpg', 0, 15);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Lemon Butter Fish', 'Fish in lemon butter sauce', 0, 'SP', '["non-veg"]', '["Fish","Lemon","Butter","Herbs"]', 'images/fish-tikka.jpg', 0, 16);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Peanut Masala', 'Spiced roasted peanuts', 10000, '', '["veg"]', '["Peanuts","Spices","Onions","Lemon"]', 'images/chana-masala.jpg', 1, 17);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Onion/ Potato/ Mix Pakora', 'Crispy fritters', 15000, '₹150/150/170', '["veg"]', '["Onion/Potato/Mix","Gram flour","Spices"]', 'images/vegetable-samosa.jpg', 1, 18);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chicken Kebab', 'Grilled chicken kebab', 22000, '', '["non-veg"]', '["Chicken","Yogurt","Spices"]', 'images/chicken-tikka.jpg', 1, 19);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Chilli Cheese Toast', 'Spicy cheese toast', 18000, '', '["veg","spicy"]', '["Bread","Cheese","Chilies","Spices"]', 'images/cheese-garlic-naan.jpg', 1, 20);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Prawn Rava Fry', 'Semolina coated fried prawns', 0, 'SP', '["non-veg"]', '["Prawns","Rava","Spices"]', 'images/fish-tikka.jpg', 0, 21);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (5, 'Fish Fry (Masala/ Rava)', 'Fried fish fillet', 0, 'SP', '["non-veg"]', '["Fish","Spices","Rava/Masala"]', 'images/fish-tikka.jpg', 0, 22);

-- Bowls
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Rajma Chawal', 'Kidney beans curry with rice', 19000, '', '["veg"]', '["Rajma","Rice","Tomatoes","Spices"]', 'images/dal-makhani.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Chole Chawal', 'Chickpea curry with rice', 17000, '', '["veg"]', '["Chickpeas","Rice","Spices"]', 'images/chana-masala.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Dal Makhani Rice', 'Creamy dal with rice', 17000, '', '["veg"]', '["Black lentils","Rice","Butter","Cream"]', 'images/dal-makhani.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Khichdi', 'Rice and lentil porridge', 15000, '', '["veg"]', '["Rice","Lentils","Spices","Ghee"]', 'images/jeera-rice.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Paneer Masala Rice', 'Paneer curry with rice', 23000, '', '["veg"]', '["Paneer","Rice","Tomatoes","Cream","Spices"]', 'images/paneer-butter-masala.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Home-made Chicken Curry', 'Traditional chicken curry with rice', 24000, '', '["non-veg"]', '["Chicken","Rice","Onions","Tomatoes","Spices"]', 'images/butter-chicken.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Fish Curry', 'Coastal fish curry with rice', 0, 'SP', '["non-veg"]', '["Fish","Rice","Coconut","Spices"]', 'images/fish-tikka.jpg', 0, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (6, 'Prawn Rice', 'Prawn curry with rice', 0, 'SP', '["non-veg"]', '["Prawns","Rice","Spices"]', 'images/fish-tikka.jpg', 0, 8);

-- Salads
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (7, 'Caesar Salad', 'Classic Caesar with croutons and parmesan', 21000, '', '["veg"]', '["Romaine lettuce","Parmesan","Croutons","Caesar dressing"]', 'images/caesar-salad.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (7, 'Green Salad', 'Fresh mixed greens', 10000, '', '["veg"]', '["Mixed greens","Vegetables","Dressing"]', 'images/greek-salad.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (7, 'Fruit Salad', 'Fresh seasonal fruits', 15000, '', '["veg"]', '["Seasonal fruits"]', 'images/greek-salad.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (7, 'Red-Hot Salad', 'Spicy salad with chilies', 15000, '', '["veg","spicy"]', '["Mixed vegetables","Chilies","Spices"]', 'images/asian-noodle-salad.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (7, 'Tuna Salad', 'Fresh tuna with greens', 27000, '', '["non-veg"]', '["Tuna","Mixed greens","Vegetables","Dressing"]', 'images/grilled-chicken-salad.jpg', 1, 5);

-- Pizza
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'Margarita', 'Classic tomato and mozzarella', 27000, '', '["veg"]', '["Pizza base","Tomato sauce","Mozzarella","Basil"]', 'images/cheese-naan.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'Country Special', 'Loaded vegetable pizza', 32000, '', '["veg"]', '["Pizza base","Mixed vegetables","Cheese","Sauce"]', 'images/paneer-butter-masala.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'Farmhouse', 'Fresh vegetable farmhouse pizza', 34000, '', '["veg"]', '["Pizza base","Capsicum","Mushrooms","Onions","Cheese"]', 'images/paneer-butter-masala.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'Tandoori Chicken', 'Tandoori chicken pizza', 35000, '', '["non-veg"]', '["Pizza base","Tandoori chicken","Onions","Cheese"]', 'images/chicken-tikka-masala.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'Peri-peri Chicken', 'Spicy peri-peri chicken pizza', 36000, '', '["non-veg","spicy"]', '["Pizza base","Chicken","Peri-peri sauce","Cheese"]', 'images/kadai-chicken.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (8, 'BBQ Chicken', 'BBQ chicken pizza', 36000, '', '["non-veg"]', '["Pizza base","BBQ chicken","Onions","Cheese"]', 'images/chicken-tikka-masala.jpg', 1, 6);

-- Pasta
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (9, 'Alfredo', 'Creamy white sauce pasta', 27000, '₹270/320', '["veg"]', '["Pasta","Cream","Cheese","Garlic","Butter"]', 'images/paneer-butter-masala.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (9, 'Arrabiata', 'Spicy tomato sauce pasta', 29000, '₹290/340', '["veg","spicy"]', '["Pasta","Tomatoes","Chilies","Garlic","Olive oil"]', 'images/chana-masala.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (9, 'Panna Rosé', 'Pink sauce pasta', 29000, '₹290/340', '["veg"]', '["Pasta","Tomato sauce","Cream","Cheese"]', 'images/paneer-butter-masala.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (9, 'Mac & Cheese', 'Classic mac and cheese', 35000, '₹350/400', '["veg"]', '["Macaroni","Cheese sauce","Butter"]', 'images/cheese-naan.jpg', 1, 4);

-- Steak
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (10, 'Herb-run Paneer Steak', 'Herb-marinated grilled paneer', 34000, '', '["veg"]', '["Paneer","Herbs","Mashed potatoes","Vegetables","Gravy"]', 'images/paneer-tikka.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (10, 'Tandoori Paneer Steak', 'Tandoori spiced paneer steak', 34000, '', '["veg"]', '["Paneer","Tandoori spices","Mashed potatoes","Vegetables","Gravy"]', 'images/paneer-tikka.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (10, 'Herb-run Chicken Steak', 'Herb-marinated grilled chicken', 39000, '', '["non-veg"]', '["Chicken","Herbs","Mashed potatoes","Vegetables","Gravy"]', 'images/chicken-tikka.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (10, 'Tandoori Chicken Steak', 'Tandoori spiced chicken steak', 39000, '', '["non-veg"]', '["Chicken","Tandoori spices","Mashed potatoes","Vegetables","Gravy"]', 'images/chicken-tikka.jpg', 1, 4);

-- Chinese
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Veg Fried Rice', 'Mixed vegetable fried rice', 20000, '', '["veg"]', '["Rice","Mixed vegetables","Soy sauce","Spices"]', 'images/fried-rice.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Egg Fried Rice', 'Fried rice with egg', 22000, '', '["veg"]', '["Rice","Egg","Vegetables","Soy sauce"]', 'images/egg-fried-rice.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Chicken Fried Rice', 'Fried rice with chicken', 24000, '', '["non-veg"]', '["Rice","Chicken","Vegetables","Soy sauce"]', 'images/chicken-biryani.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Prawn Fried Rice', 'Fried rice with prawns', 0, 'SP', '["non-veg"]', '["Rice","Prawns","Vegetables","Soy sauce"]', 'images/fish-tikka.jpg', 0, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Veg. Noodles', 'Stir-fried vegetable noodles', 21000, '', '["veg"]', '["Noodles","Mixed vegetables","Soy sauce","Spices"]', 'images/asian-noodle-salad.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Egg Noodles', 'Noodles with egg', 21000, '', '["veg"]', '["Noodles","Egg","Vegetables","Soy sauce"]', 'images/asian-noodle-salad.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Chicken Noodles', 'Noodles with chicken', 25000, '', '["non-veg"]', '["Noodles","Chicken","Vegetables","Soy sauce"]', 'images/asian-noodle-salad.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Prawn Noodles', 'Noodles with prawns', 0, 'SP', '["non-veg"]', '["Noodles","Prawns","Vegetables","Soy sauce"]', 'images/asian-noodle-salad.jpg', 0, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Paneer Chilli Gravy', 'Paneer in spicy Chinese gravy', 23000, '', '["veg","spicy"]', '["Paneer","Bell peppers","Sauces","Spices"]', 'images/paneer-tikka.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Mushroom Chilli Gravy', 'Mushrooms in spicy Chinese gravy', 26000, '', '["veg","spicy"]', '["Mushrooms","Bell peppers","Sauces","Spices"]', 'images/hara-bhara-kabab.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Egg Chilli Gravy', 'Eggs in spicy Chinese gravy', 21000, '', '["veg","spicy"]', '["Eggs","Bell peppers","Sauces","Spices"]', 'images/egg-fried-rice.jpg', 1, 11);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (11, 'Chicken Chilli Gravy', 'Chicken in spicy Chinese gravy', 24000, '', '["non-veg","spicy"]', '["Chicken","Bell peppers","Sauces","Spices"]', 'images/kadai-chicken.jpg', 1, 12);

-- Indian Mains
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Chana Masala', 'Spiced chickpea curry', 18000, '', '["veg"]', '["Chickpeas","Tomatoes","Onions","Spices"]', 'images/chana-masala.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Dal Fry', 'Tempered lentils', 15000, '', '["veg"]', '["Lentils","Onions","Tomatoes","Spices"]', 'images/dal-makhani.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Paneer Butter Masala', 'Paneer in rich tomato gravy', 23000, '', '["veg"]', '["Paneer","Tomatoes","Butter","Cream","Spices"]', 'images/paneer-butter-masala.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Mushroom Masala', 'Mushrooms in spiced gravy', 25000, '', '["veg"]', '["Mushrooms","Tomatoes","Onions","Cream","Spices"]', 'images/dal-makhani.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Mix Veg', 'Mixed vegetable curry', 17000, '', '["veg"]', '["Mixed vegetables","Tomatoes","Spices"]', 'images/paneer-butter-masala.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Aloo Matar', 'Potato and peas curry', 17000, '', '["veg"]', '["Potatoes","Peas","Tomatoes","Spices"]', 'images/chana-masala.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Matar Paneer', 'Peas and paneer curry', 22000, '', '["veg"]', '["Paneer","Peas","Tomatoes","Cream","Spices"]', 'images/paneer-butter-masala.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Egg Curry', 'Boiled eggs in spiced gravy', 18000, '', '["veg"]', '["Eggs","Tomatoes","Onions","Spices"]', 'images/egg-fried-rice.jpg', 1, 8);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Egg Keema', 'Scrambled eggs with spices', 22000, '', '["veg"]', '["Eggs","Onions","Tomatoes","Spices"]', 'images/egg-fried-rice.jpg', 1, 9);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Kadhai Paneer', 'Paneer with bell peppers in kadhai', 24000, '', '["veg"]', '["Paneer","Bell peppers","Tomatoes","Spices"]', 'images/paneer-tikka.jpg', 1, 10);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Butter Chicken Masala', 'Classic butter chicken', 26000, '', '["non-veg"]', '["Chicken","Tomatoes","Butter","Cream","Spices"]', 'images/butter-chicken.jpg', 1, 11);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Kadhai Chicken', 'Chicken with bell peppers in kadhai', 25000, '', '["non-veg"]', '["Chicken","Bell peppers","Tomatoes","Spices"]', 'images/kadai-chicken.jpg', 1, 12);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Fish Curry', 'Fresh fish in coastal curry', 0, 'SP', '["non-veg"]', '["Fish","Coconut","Spices","Tamarind"]', 'images/fish-tikka.jpg', 0, 13);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (12, 'Prawn Masala', 'Prawns in spiced masala', 0, 'SP', '["non-veg"]', '["Prawns","Tomatoes","Onions","Spices"]', 'images/fish-tikka.jpg', 0, 14);

-- Breads
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Chapati', 'Whole wheat flatbread', 2000, '', '["veg"]', '["Whole wheat flour","Water","Salt"]', 'images/tandoori-roti.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Butter Chapati', 'Chapati with butter', 3000, '', '["veg"]', '["Whole wheat flour","Butter"]', 'images/butter-naan.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Ghee Paratha', 'Layered flatbread with ghee', 6000, '', '["veg"]', '["Wheat flour","Ghee"]', 'images/butter-naan.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Naan', 'Leavened flatbread', 6000, '', '["veg"]', '["All-purpose flour","Yogurt","Yeast"]', 'images/butter-naan.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Butter Naan', 'Naan with butter', 7000, '', '["veg"]', '["All-purpose flour","Butter","Yogurt"]', 'images/butter-naan.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Cheese Naan', 'Naan stuffed with cheese', 12000, '', '["veg"]', '["All-purpose flour","Cheese","Butter"]', 'images/cheese-naan.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (13, 'Cheese Garlic Naan', 'Cheese naan with garlic', 14000, '', '["veg"]', '["All-purpose flour","Cheese","Garlic","Butter"]', 'images/cheese-garlic-naan.jpg', 1, 7);

-- Rice
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Steam Rice', 'Plain steamed rice', 8000, '', '["veg"]', '["Basmati rice"]', 'images/jeera-rice.jpg', 1, 1);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Jeera Rice', 'Cumin flavored rice', 10000, '', '["veg"]', '["Basmati rice","Cumin","Ghee"]', 'images/jeera-rice.jpg', 1, 2);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Curd Rice', 'Rice with yogurt', 14000, '', '["veg"]', '["Rice","Yogurt","Tempering"]', 'images/jeera-rice.jpg', 1, 3);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Ghee Rice', 'Fragrant ghee rice', 14000, '', '["veg"]', '["Basmati rice","Ghee","Spices"]', 'images/jeera-rice.jpg', 1, 4);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Veg. Biryani', 'Aromatic vegetable biryani', 20000, '', '["veg"]', '["Basmati rice","Vegetables","Spices","Saffron"]', 'images/vegetable-biryani.jpg', 1, 5);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Egg Biryani', 'Biryani with boiled eggs', 22000, '', '["veg"]', '["Basmati rice","Eggs","Spices","Saffron"]', 'images/egg-fried-rice.jpg', 1, 6);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Chicken Biryani', 'Classic chicken biryani', 25000, '', '["non-veg"]', '["Basmati rice","Chicken","Spices","Saffron"]', 'images/chicken-biryani.jpg', 1, 7);
INSERT INTO menu_items (category_id, name, description, price, price_text, tags, ingredients, image_url, is_available, display_order) VALUES (14, 'Prawn Biryani', 'Biryani with prawns', 0, 'SP', '["non-veg"]', '["Basmati rice","Prawns","Spices","Saffron"]', 'images/mutton-biryani.jpg', 0, 8);

