import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const queries = readFileSync("src/db/queries.ts", "utf8");
const ui = readFileSync("src/components/admin/ChannelManager.tsx", "utf8");
const route = readFileSync("src/app/api/admin/channel-manager/route.ts", "utf8");

describe("room type mapping insert", () => {
  it("does not let Drizzle send id=null on D1 AUTOINCREMENT insert", () => {
    const fn = queries.match(/export async function upsertRoomTypeMapping[\s\S]*?^export async function deleteRoomTypeMapping/m);
    expect(fn).not.toBeNull();
    const body = fn![0];
    expect(body).toMatch(/INSERT INTO room_type_mapping \(dorm_id,/);
    expect(body).not.toMatch(/insert\(roomTypeMapping\)\.values/);
    expect(body).toMatch(/No dorm with id/);
    expect(body).toMatch(/eq\(roomTypeMapping\.dormId/);
    expect(body).toMatch(/already mapped to/);
  });

  it("rate plan insert also omits the id column", () => {
    const fn = queries.match(/export async function upsertRatePlanMapping[\s\S]*?^export async function deleteRatePlanMapping/m);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/INSERT INTO rate_plan_mapping \(room_mapping_id,/);
    expect(fn![0]).not.toMatch(/insert\(ratePlanMapping\)\.values/);
    expect(fn![0]).toMatch(/Map the room first/);
  });
});

describe("room mapping UI", () => {
  it("lists every dorm, including unmapped ones from Management → Dorms", () => {
    expect(route).toMatch(/dormsWithCounts/);
    expect(route).toMatch(/nameById\.get\(m\.dormId\)/);
    expect(ui).toMatch(/Not mapped/);
    expect(ui).toMatch(/remoteRooms/);
    expect(route).toMatch(/getAiosellPropertyDetails/);
    expect(ui).toMatch(/PencilIcon/);
    expect(ui).toMatch(/local dorm names are never guessed/);
    expect(ui).not.toMatch(/placeholder="Dorm ID"/);
    expect(ui).not.toMatch(/Select dorm/);
  });
});

describe("dorm delete cleans channel mappings", () => {
  it("deleteDormAndBeds removes room_type_mapping rows for that dorm first", () => {
    const fn = queries.match(/export async function deleteDormAndBeds[\s\S]*?^export async function /m);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/deleteRoomTypeMapping/);
    expect(fn![0]).toMatch(/roomTypeMapping\.dormId/);
  });
});

describe("saveRoomMapping API", () => {
  it("does not pass the client body through to insert", () => {
    expect(route).toMatch(/const dormId = Number\(mapping\?\.dormId\)/);
    expect(route).not.toMatch(/upsertRoomTypeMapping\(\{ \.\.\.mapping/);
  });
});
