-- Strip the 'images/' prefix from image_url values so the component constructs the full path
UPDATE menu_items SET image_url = REPLACE(image_url, 'images/', '') WHERE image_url LIKE 'images/%';
