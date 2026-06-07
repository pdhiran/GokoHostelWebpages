-- Migration 0010: Add Kannada names to menu categories and items
-- Adds name_kannada column and populates with Kannada translations

ALTER TABLE menu_categories ADD COLUMN name_kannada TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN name_kannada TEXT DEFAULT '';

-- Category Kannada names
UPDATE menu_categories SET name_kannada = 'ದಿನವಿಡೀ ಉಪಾಹಾರ' WHERE id = 1;
UPDATE menu_categories SET name_kannada = 'ಬಿಸಿ ಪಾನೀಯಗಳು' WHERE id = 2;
UPDATE menu_categories SET name_kannada = 'ತಂಪು ಪಾನೀಯಗಳು' WHERE id = 3;
UPDATE menu_categories SET name_kannada = 'ಸ್ಯಾಂಡ್‌ವಿಚ್‌ಗಳು' WHERE id = 4;
UPDATE menu_categories SET name_kannada = 'ಸ್ಟಾರ್ಟರ್ಸ್' WHERE id = 5;
UPDATE menu_categories SET name_kannada = 'ಬೌಲ್ಸ್' WHERE id = 6;
UPDATE menu_categories SET name_kannada = 'ಸಲಾಡ್‌ಗಳು' WHERE id = 7;
UPDATE menu_categories SET name_kannada = 'ಪಿಜ್ಜಾ' WHERE id = 8;
UPDATE menu_categories SET name_kannada = 'ಪಾಸ್ತಾ' WHERE id = 9;
UPDATE menu_categories SET name_kannada = 'ಸ್ಟೀಕ್' WHERE id = 10;
UPDATE menu_categories SET name_kannada = 'ಚೈನೀಸ್' WHERE id = 11;
UPDATE menu_categories SET name_kannada = 'ಭಾರತೀಯ ಮುಖ್ಯ ಅಡುಗೆ' WHERE id = 12;
UPDATE menu_categories SET name_kannada = 'ರೊಟ್ಟಿಗಳು' WHERE id = 13;
UPDATE menu_categories SET name_kannada = 'ಅನ್ನ' WHERE id = 14;

-- All-Day Breakfast items
UPDATE menu_items SET name_kannada = 'ಆಮ್ಲೆಟ್' WHERE name = 'Omelette' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಮಸಾಲಾ ಆಮ್ಲೆಟ್' WHERE name = 'Masala Omelette' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಸ್ಕ್ರ್ಯಾಂಬಲ್ಡ್ ಎಗ್ಸ್' WHERE name = 'Scrambled Eggs' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಸನ್ನಿ-ಸೈಡ್ ಅಪ್' WHERE name = 'Sunny-side Up' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಬೇಯಿಸಿದ ಮೊಟ್ಟೆ' WHERE name = 'Boiled Eggs' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಟೋಸ್ಟ್' WHERE name = 'Toast' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಮ್ಯಾಗಿ' WHERE name = 'Maggi' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಚೀಸ್ ಮ್ಯಾಗಿ' WHERE name = 'Cheese Maggi' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ಮ್ಯಾಗಿ' WHERE name = 'Veg. Maggi' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಮ್ಯಾಗಿ' WHERE name = 'Egg Maggi' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಮ್ಯಾಗಿ' WHERE name = 'Chicken Maggi' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಪೂರಿ ಭಾಜಿ' WHERE name = 'Poori Bhaji' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಛೋಲೆ ಭಟೂರೆ' WHERE name = 'Chole Bhature' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಆಲೂ ಪರಾಠ' WHERE name = 'Aloo Paratha' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಗೋಬಿ ಪರಾಠ' WHERE name = 'Gobi Paratha' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಪನೀರ್ ಪರಾಠ' WHERE name = 'Paneer Paratha' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಮಿಕ್ಸ್ ಪರಾಠ' WHERE name = 'Mix Paratha' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಹನಿ ಕ್ರೇಪ್ಸ್' WHERE name = 'Honey Crepes' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ಬಾಳೆಹಣ್ಣು ಕ್ರೇಪ್ಸ್' WHERE name = 'Banana Crepes' AND category_id = 1;
UPDATE menu_items SET name_kannada = 'ನುಟೆಲ್ಲಾ ಕ್ರೇಪ್ಸ್' WHERE name = 'Nutella Crepes' AND category_id = 1;

-- Hot Beverages
UPDATE menu_items SET name_kannada = 'ಶುಂಠಿ ಚಹಾ' WHERE name = 'Ginger Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಮಸಾಲಾ ಚಹಾ' WHERE name = 'Masala Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಕಪ್ಪು ಚಹಾ' WHERE name = 'Black Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಗ್ರೀನ್ ಟೀ' WHERE name = 'Green Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಜೇನು ಶುಂಠಿ ನಿಂಬೆ ಚಹಾ' WHERE name = 'Honey Ginger Lemon Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಹಾಲು ಚಹಾ' WHERE name = 'Milk Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಹಾಲು ಕಾಫಿ' WHERE name = 'Milk Coffee' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಹ್ಯಾಝಲ್‌ನಟ್ ಕಾಫಿ' WHERE name = 'Hazelnut Coffee' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ವೆನಿಲ್ಲಾ ಕಾಫಿ' WHERE name = 'Vanilla Coffee' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಹಾಟ್ ಚಾಕಲೇಟ್' WHERE name = 'Hot Chocolate' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಬೋರ್ನ್‌ವಿಟಾ' WHERE name = 'Bournvita' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಹಾಲು' WHERE name = 'Milk' AND category_id = 2;

-- Cold Beverages
UPDATE menu_items SET name_kannada = 'ಕೋಲ್ಡ್ ಕಾಫಿ' WHERE name = 'Cold Coffee' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಓರಿಯೋ ಮಿಲ್ಕ್‌ಶೇಕ್' WHERE name = 'Oreo Milkshake' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಕಿಟ್‌ಕ್ಯಾಟ್ ಮಿಲ್ಕ್‌ಶೇಕ್' WHERE name = 'KitKat Milkshake' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಬ್ರೌನಿ ಮಿಲ್ಕ್‌ಶೇಕ್' WHERE name = 'Brownie Milkshake' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಐಸ್ಡ್ ಟೀ' WHERE name = 'Iced Tea' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಲಿಂಬೆ ನೀರು / ಸೋಡಾ' WHERE name = 'Fresh Lime Water/ Soda' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಕಲ್ಲಂಗಡಿ / ಕಿತ್ತಳೆ / ಅನಾನಸ್ ಜ್ಯೂಸ್' WHERE name = 'Watermelon/ Orange/ Pineapple Juice' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಕೋಕಂ ಶರಬತ್' WHERE name = 'Kokam Sharbat' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ರೂಹಾಫ್ಜಾ ಶೇಕ್' WHERE name = 'Roohafza Shake' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಚಾಕಲೇಟ್ ಶೇಕ್' WHERE name = 'Chocolate Shake' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಬಾಟಲಿ ಪಾನೀಯಗಳು' WHERE name = 'Aerated Bottled Beverages' AND category_id = 3;

-- Sandwiches
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ಕ್ಲಬ್' WHERE name = 'Veg. Club' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ಚೀಸ್' WHERE name = 'Veg. Cheese' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಪನೀರ್ ಭುರ್ಜಿ' WHERE name = 'Paneer Bhurji' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಬಾಂಬೆ' WHERE name = 'Bombay' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಕಾರ್ನ್ & ಚೀಸ್ ಸ್ಯಾಂಡ್‌ವಿಚ್' WHERE name = 'Corn & Cheese S/w' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಆಲೂ ಸ್ಯಾಂಡ್‌ವಿಚ್' WHERE name = 'Potato Sandwich' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಪೆರಿ-ಪೆರಿ ಚಿಕನ್' WHERE name = 'Peri-peri Chicken' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ತಂದೂರಿ ಚಿಕನ್' WHERE name = 'Tandoori Chicken' AND category_id = 4;
UPDATE menu_items SET name_kannada = 'ಟ್ಯೂನಾ' WHERE name = 'Tuna' AND category_id = 4;

-- Appetizers
UPDATE menu_items SET name_kannada = 'ಕ್ರಿಸ್ಪಿ ಕಾರ್ನ್' WHERE name = 'Crispy Corn' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಕಾರ್ನ್ ಚಾಟ್' WHERE name = 'Corn Chat' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಫ್ರೆಂಚ್ ಫ್ರೈಸ್ (ಉಪ್ಪು / ಪೆರಿ-ಪೆರಿ)' WHERE name = 'French Fries (Salted/ Peri-peri)' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ವಿಂಗ್ಸ್ (ಬಫಲೋ / ಪೆರಿ-ಪೆರಿ)' WHERE name = 'Chicken Wings (Buffalo/ Peri-peri)' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಗೋಕೋ ಸ್ಪೆಷಲ್ ಫೈರಿ ವಿಂಗ್ಸ್' WHERE name = 'Goko Special Fiery Wings' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚೀಸ್ ಹಲಪೇನೋ ಪಾಪರ್ಸ್' WHERE name = 'Cheese Jalapeño Poppers' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚೀಸ್ ಗಾರ್ಲಿಕ್ ಟೋಸ್ಟ್' WHERE name = 'Cheese Garlic Toast' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಕ್ರಿಸ್ಪಿ ಚಿಲ್ಲಿ ಬೇಬಿಕಾರ್ನ್' WHERE name = 'Crispy Chilli Babycorn' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಹನಿ ಚಿಲ್ಲಿ ಪೊಟ್ಯಾಟೋ' WHERE name = 'Honey Chilli Potato' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಗೋಬಿ ಮಂಚೂರಿಯನ್' WHERE name = 'Gobi Manchurian' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಲ್ಲಿ ಪನೀರ್' WHERE name = 'Chilli Paneer' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಡೆವಿಲ್ಡ್ ಎಗ್ಸ್' WHERE name = 'Deviled Eggs' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಪಾಪ್‌ಕಾರ್ನ್' WHERE name = 'Chicken Popcorn' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಲ್ಲಿ ಚಿಕನ್' WHERE name = 'Chilli Chicken' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಬಟರ್ ಗಾರ್ಲಿಕ್ ಸಿಗಡಿ' WHERE name = 'Butter Garlic Prawn' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಲೆಮನ್ ಬಟರ್ ಮೀನು' WHERE name = 'Lemon Butter Fish' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಕಡಲೆಕಾಯಿ ಮಸಾಲಾ' WHERE name = 'Peanut Masala' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಈರುಳ್ಳಿ / ಆಲೂ / ಮಿಕ್ಸ್ ಪಕೋಡ' WHERE name = 'Onion/ Potato/ Mix Pakora' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಕಬಾಬ್' WHERE name = 'Chicken Kebab' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಚಿಲ್ಲಿ ಚೀಸ್ ಟೋಸ್ಟ್' WHERE name = 'Chilli Cheese Toast' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ರವಾ ಫ್ರೈ' WHERE name = 'Prawn Rava Fry' AND category_id = 5;
UPDATE menu_items SET name_kannada = 'ಮೀನು ಫ್ರೈ (ಮಸಾಲಾ / ರವಾ)' WHERE name = 'Fish Fry (Masala/ Rava)' AND category_id = 5;

-- Bowls
UPDATE menu_items SET name_kannada = 'ರಾಜ್ಮಾ ಚಾವಲ್' WHERE name = 'Rajma Chawal' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಛೋಲೆ ಚಾವಲ್' WHERE name = 'Chole Chawal' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ದಾಲ್ ಮಖನಿ ಅನ್ನ' WHERE name = 'Dal Makhani Rice' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಕಿಚಡಿ' WHERE name = 'Khichdi' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಪನೀರ್ ಮಸಾಲಾ ಅನ್ನ' WHERE name = 'Paneer Masala Rice' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಮನೆ ಶೈಲಿ ಚಿಕನ್ ಕರಿ' WHERE name = 'Home-made Chicken Curry' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಮೀನು ಸಾರು' WHERE name = 'Fish Curry' AND category_id = 6;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ಅನ್ನ' WHERE name = 'Prawn Rice' AND category_id = 6;

-- Salads
UPDATE menu_items SET name_kannada = 'ಸೀಸರ್ ಸಲಾಡ್' WHERE name = 'Caesar Salad' AND category_id = 7;
UPDATE menu_items SET name_kannada = 'ಹಸಿರು ಸಲಾಡ್' WHERE name = 'Green Salad' AND category_id = 7;
UPDATE menu_items SET name_kannada = 'ಹಣ್ಣಿನ ಸಲಾಡ್' WHERE name = 'Fruit Salad' AND category_id = 7;
UPDATE menu_items SET name_kannada = 'ಖಾರದ ಸಲಾಡ್' WHERE name = 'Red-Hot Salad' AND category_id = 7;
UPDATE menu_items SET name_kannada = 'ಟ್ಯೂನಾ ಸಲಾಡ್' WHERE name = 'Tuna Salad' AND category_id = 7;

-- Pizza
UPDATE menu_items SET name_kannada = 'ಮಾರ್ಗರೀಟಾ' WHERE name = 'Margarita' AND category_id = 8;
UPDATE menu_items SET name_kannada = 'ಕಂಟ್ರಿ ಸ್ಪೆಷಲ್' WHERE name = 'Country Special' AND category_id = 8;
UPDATE menu_items SET name_kannada = 'ಫಾರ್ಮ್‌ಹೌಸ್' WHERE name = 'Farmhouse' AND category_id = 8;
UPDATE menu_items SET name_kannada = 'ತಂದೂರಿ ಚಿಕನ್' WHERE name = 'Tandoori Chicken' AND category_id = 8;
UPDATE menu_items SET name_kannada = 'ಪೆರಿ-ಪೆರಿ ಚಿಕನ್' WHERE name = 'Peri-peri Chicken' AND category_id = 8;
UPDATE menu_items SET name_kannada = 'ಬಿಬಿಕ್ಯೂ ಚಿಕನ್' WHERE name = 'BBQ Chicken' AND category_id = 8;

-- Pasta
UPDATE menu_items SET name_kannada = 'ಆಲ್ಫ್ರೆಡೋ' WHERE name = 'Alfredo' AND category_id = 9;
UPDATE menu_items SET name_kannada = 'ಅರಾಬಿಯಾಟ' WHERE name = 'Arrabiata' AND category_id = 9;
UPDATE menu_items SET name_kannada = 'ಪನ್ನಾ ರೋಸೆ' WHERE name = 'Panna Rosé' AND category_id = 9;
UPDATE menu_items SET name_kannada = 'ಮ್ಯಾಕ್ & ಚೀಸ್' WHERE name = 'Mac & Cheese' AND category_id = 9;

-- Steak
UPDATE menu_items SET name_kannada = 'ಹರ್ಬ್ ಪನೀರ್ ಸ್ಟೀಕ್' WHERE name = 'Herb-run Paneer Steak' AND category_id = 10;
UPDATE menu_items SET name_kannada = 'ತಂದೂರಿ ಪನೀರ್ ಸ್ಟೀಕ್' WHERE name = 'Tandoori Paneer Steak' AND category_id = 10;
UPDATE menu_items SET name_kannada = 'ಹರ್ಬ್ ಚಿಕನ್ ಸ್ಟೀಕ್' WHERE name = 'Herb-run Chicken Steak' AND category_id = 10;
UPDATE menu_items SET name_kannada = 'ತಂದೂರಿ ಚಿಕನ್ ಸ್ಟೀಕ್' WHERE name = 'Tandoori Chicken Steak' AND category_id = 10;

-- Chinese
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ಫ್ರೈಡ್ ರೈಸ್' WHERE name = 'Veg Fried Rice' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಫ್ರೈಡ್ ರೈಸ್' WHERE name = 'Egg Fried Rice' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಫ್ರೈಡ್ ರೈಸ್' WHERE name = 'Chicken Fried Rice' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ಫ್ರೈಡ್ ರೈಸ್' WHERE name = 'Prawn Fried Rice' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ನೂಡಲ್ಸ್' WHERE name = 'Veg. Noodles' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ನೂಡಲ್ಸ್' WHERE name = 'Egg Noodles' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ನೂಡಲ್ಸ್' WHERE name = 'Chicken Noodles' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ನೂಡಲ್ಸ್' WHERE name = 'Prawn Noodles' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಪನೀರ್ ಚಿಲ್ಲಿ ಗ್ರೇವಿ' WHERE name = 'Paneer Chilli Gravy' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಮಶ್ರೂಮ್ ಚಿಲ್ಲಿ ಗ್ರೇವಿ' WHERE name = 'Mushroom Chilli Gravy' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಚಿಲ್ಲಿ ಗ್ರೇವಿ' WHERE name = 'Egg Chilli Gravy' AND category_id = 11;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಚಿಲ್ಲಿ ಗ್ರೇವಿ' WHERE name = 'Chicken Chilli Gravy' AND category_id = 11;

-- Indian Mains
UPDATE menu_items SET name_kannada = 'ಚನಾ ಮಸಾಲಾ' WHERE name = 'Chana Masala' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ದಾಲ್ ಫ್ರೈ' WHERE name = 'Dal Fry' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಪನೀರ್ ಬಟರ್ ಮಸಾಲಾ' WHERE name = 'Paneer Butter Masala' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮಶ್ರೂಮ್ ಮಸಾಲಾ' WHERE name = 'Mushroom Masala' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮಿಕ್ಸ್ ವೆಜ್' WHERE name = 'Mix Veg' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಆಲೂ ಮಟರ್' WHERE name = 'Aloo Matar' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮಟರ್ ಪನೀರ್' WHERE name = 'Matar Paneer' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಕರಿ' WHERE name = 'Egg Curry' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಕೀಮಾ' WHERE name = 'Egg Keema' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಕಡಾಯಿ ಪನೀರ್' WHERE name = 'Kadhai Paneer' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಬಟರ್ ಚಿಕನ್ ಮಸಾಲಾ' WHERE name = 'Butter Chicken Masala' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಕಡಾಯಿ ಚಿಕನ್' WHERE name = 'Kadhai Chicken' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಮೀನು ಸಾರು' WHERE name = 'Fish Curry' AND category_id = 12;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ಮಸಾಲಾ' WHERE name = 'Prawn Masala' AND category_id = 12;

-- Breads
UPDATE menu_items SET name_kannada = 'ಚಪಾತಿ' WHERE name = 'Chapati' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ಬಟರ್ ಚಪಾತಿ' WHERE name = 'Butter Chapati' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ತುಪ್ಪದ ಪರಾಠ' WHERE name = 'Ghee Paratha' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ನಾನ್' WHERE name = 'Naan' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ಬಟರ್ ನಾನ್' WHERE name = 'Butter Naan' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ಚೀಸ್ ನಾನ್' WHERE name = 'Cheese Naan' AND category_id = 13;
UPDATE menu_items SET name_kannada = 'ಚೀಸ್ ಗಾರ್ಲಿಕ್ ನಾನ್' WHERE name = 'Cheese Garlic Naan' AND category_id = 13;

-- Rice
UPDATE menu_items SET name_kannada = 'ಬೆಂದ ಅನ್ನ' WHERE name = 'Steam Rice' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ಜೀರಾ ಅನ್ನ' WHERE name = 'Jeera Rice' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ಮೊಸರನ್ನ' WHERE name = 'Curd Rice' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ತುಪ್ಪದ ಅನ್ನ' WHERE name = 'Ghee Rice' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ವೆಜ್ ಬಿರಿಯಾನಿ' WHERE name = 'Veg. Biryani' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ಮೊಟ್ಟೆ ಬಿರಿಯಾನಿ' WHERE name = 'Egg Biryani' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ಚಿಕನ್ ಬಿರಿಯಾನಿ' WHERE name = 'Chicken Biryani' AND category_id = 14;
UPDATE menu_items SET name_kannada = 'ಸಿಗಡಿ ಬಿರಿಯಾನಿ' WHERE name = 'Prawn Biryani' AND category_id = 14;
