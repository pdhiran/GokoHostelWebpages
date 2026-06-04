-- Add form_c_data column for storing Form C (FRRO) structured data for foreign guests
ALTER TABLE checkins ADD COLUMN form_c_data TEXT DEFAULT '';
