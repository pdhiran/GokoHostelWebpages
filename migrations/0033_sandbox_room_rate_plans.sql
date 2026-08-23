-- Migration 0033: Seed room mappings + rate plans for Aiosell sandbox
-- Maps: Luxury Dorm -> executive, Female Dorm -> suite
-- Rate plans: s-ep, d-ep, s-cp, d-cp for each room

-- 1. Room Type Mappings
INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'executive', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Luxury Dorm';

INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'suite', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Female Dorm';

-- 2. Rate Plans for 'executive'
INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'executive-s-ep', 'Executive Single EP' FROM room_type_mapping WHERE channel_room_code = 'executive';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'executive-d-ep', 'Executive Double EP' FROM room_type_mapping WHERE channel_room_code = 'executive';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'executive-s-cp', 'Executive Single CP' FROM room_type_mapping WHERE channel_room_code = 'executive';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'executive-d-cp', 'Executive Double CP' FROM room_type_mapping WHERE channel_room_code = 'executive';

-- 3. Rate Plans for 'suite'
INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'suite-s-ep', 'Suite Single EP' FROM room_type_mapping WHERE channel_room_code = 'suite';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'suite-d-ep', 'Suite Double EP' FROM room_type_mapping WHERE channel_room_code = 'suite';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'suite-s-cp', 'Suite Single CP' FROM room_type_mapping WHERE channel_room_code = 'suite';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'suite-d-cp', 'Suite Double CP' FROM room_type_mapping WHERE channel_room_code = 'suite';
