-- Migration 0012: Fix Kannada name corrections per user feedback

UPDATE menu_items SET name_kannada = 'ಬ್ಲಾಕ್ ಟೀ' WHERE name = 'Black Tea' AND category_id = 2;
UPDATE menu_items SET name_kannada = 'ಲಿಂಬೆ ಶರಬತ್/ ಸೋಡಾ' WHERE name = 'Fresh Lime Water/ Soda' AND category_id = 3;
UPDATE menu_items SET name_kannada = 'ಪನ್ನಾ ರೋಜ್' WHERE name = 'Panna Rosé' AND category_id = 9;
UPDATE menu_items SET name_kannada = 'ಅನ್ನ' WHERE name = 'Steam Rice' AND category_id = 14;
