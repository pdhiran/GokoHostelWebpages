-- Migration 0034: Create room mappings + rate plans (EP, MAP, CP) for production dorms
-- Dorms: Dorm 1, Dorm 2, Female dorm, Shiva dorm

-- 1. Room Type Mappings
INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'dorm-1', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Dorm 1';

INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'dorm-2', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Dorm 2';

INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'female-dorm', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Female dorm';

INSERT OR IGNORE INTO room_type_mapping (dorm_id, dorm_name, channel_room_code, total_inventory)
SELECT id, name, 'shiva-dorm', (SELECT COUNT(*) FROM beds WHERE dorm_id = dorms.id)
FROM dorms WHERE name = 'Shiva dorm';

-- 2. Rate Plans: EP (room only)
INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-1-ep', 'EP' FROM room_type_mapping WHERE channel_room_code = 'dorm-1';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-2-ep', 'EP' FROM room_type_mapping WHERE channel_room_code = 'dorm-2';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'female-dorm-ep', 'EP' FROM room_type_mapping WHERE channel_room_code = 'female-dorm';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'shiva-dorm-ep', 'EP' FROM room_type_mapping WHERE channel_room_code = 'shiva-dorm';

-- 3. Rate Plans: MAP (room + meals)
INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-1-map', 'MAP' FROM room_type_mapping WHERE channel_room_code = 'dorm-1';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-2-map', 'MAP' FROM room_type_mapping WHERE channel_room_code = 'dorm-2';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'female-dorm-map', 'MAP' FROM room_type_mapping WHERE channel_room_code = 'female-dorm';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'shiva-dorm-map', 'MAP' FROM room_type_mapping WHERE channel_room_code = 'shiva-dorm';

-- 4. Rate Plans: CP (room + breakfast)
INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-1-cp', 'CP' FROM room_type_mapping WHERE channel_room_code = 'dorm-1';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'dorm-2-cp', 'CP' FROM room_type_mapping WHERE channel_room_code = 'dorm-2';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'female-dorm-cp', 'CP' FROM room_type_mapping WHERE channel_room_code = 'female-dorm';

INSERT OR IGNORE INTO rate_plan_mapping (room_mapping_id, rate_plan_code, rate_plan_name)
SELECT id, 'shiva-dorm-cp', 'CP' FROM room_type_mapping WHERE channel_room_code = 'shiva-dorm';
