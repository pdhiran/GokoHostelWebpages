import { describe, expect, it } from "vitest";
import { invalidRatePlans, invalidRoomCodes, thirtyDayRange, validDateRange, warningRoomCodes } from "@/lib/aiosellValidation";

const property = { hotel_id: "sandbox-pms", rooms: [
  { room_id: "executive", active: true, rateplans: [{ rateplan_id: "ep" }] },
  { room_id: "suite", active: true, rateplans: [] },
  { room_id: "old-room", active: false, rateplans: [] },
] };

describe("Aiosell preflight workflows", () => {
  it("catches the incident's four guessed room codes before POST", () => {
    expect(invalidRoomCodes(property, ["dorm-1", "dorm-2", "executive", "female-dorm", "shiva-dorm", "suite"]))
      .toEqual(["dorm-1", "dorm-2", "female-dorm", "shiva-dorm"]);
  });

  it("rejects inactive rooms and mismatched rate plans", () => {
    expect(invalidRoomCodes(property, ["old-room"])).toEqual(["old-room"]);
    expect(invalidRatePlans(property, [{ roomCode: "executive", rateplanCode: "wrong" }])).toHaveLength(1);
  });

  it("uses inclusive dates and a true 30-day default", () => {
    expect(validDateRange("2026-09-01", "2026-09-01")).toBe(true);
    expect(validDateRange("2026-09-02", "2026-09-01")).toBe(false);
    expect(validDateRange("2026-02-30", "2026-03-01")).toBe(false);
    expect(thirtyDayRange("2026-09-01")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("extracts the real warning instead of the generic success message", () => {
    expect(warningRoomCodes(["INVALID_ROOM_CODE : dorm-1"])).toEqual(["dorm-1"]);
  });
});
