-- Preserve a specific label for manual income recorded under the Other source.
ALTER TABLE daily_income ADD COLUMN source_detail TEXT DEFAULT '';
