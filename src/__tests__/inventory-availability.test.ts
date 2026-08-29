import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  bedsFitInventoryCap,
  capPhysicalBedsToInventory,
  inventoryAvailableForNight,
  inventoryCapForStay,
  stayNights,
} from "@/lib/inventoryAvailability";

const queries = readFileSync("src/db/queries.ts", "utf8");
const route = readFileSync("src/app/api/admin/bookings/route.ts", "utf8");

function executiveBeds() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    dormId: 2,
    bedId: `EXE-${i + 1}`,
  }));
}

describe("stayNights", () => {
  it("uses exclusive checkout so 31 Aug–1 Sep is one night", () => {
    expect(stayNights("2026-08-31", "2026-09-01")).toEqual(["2026-08-31"]);
    expect(stayNights("2026-08-31", "2026-09-02")).toEqual(["2026-08-31", "2026-09-01"]);
    expect(stayNights("2026-08-31", "2026-08-31")).toEqual([]);
  });
});

describe("New Booking picker matches inventory", () => {
  it("caps EXECUTIVE to override 5 when 12 beds are physically free", () => {
    const beds = executiveBeds();
    const nights = stayNights("2026-08-31", "2026-09-01");
    const overrides = [{ dormId: 2, date: "2026-08-31", onlineAvailable: 5, channelId: null }];
    expect(inventoryAvailableForNight(2, "2026-08-31", beds, [], [], overrides)).toBe(5);

    const capped = capPhysicalBedsToInventory(beds, beds, nights, [], [], overrides);
    expect(capped).toHaveLength(5);
    expect(capped.map((b) => b.bedId)).toEqual(["EXE-1", "EXE-2", "EXE-3", "EXE-4", "EXE-5"]);
  });

  it("uses the min inventory across nights of a stay", () => {
    const beds = executiveBeds();
    const nights = stayNights("2026-08-31", "2026-09-02");
    const overrides = [
      { dormId: 2, date: "2026-08-31", onlineAvailable: 5, channelId: null },
      { dormId: 2, date: "2026-09-01", onlineAvailable: 2, channelId: null },
    ];
    expect(inventoryCapForStay(2, nights, beds, [], [], overrides)).toBe(2);
    expect(capPhysicalBedsToInventory(beds, beds, nights, [], [], overrides)).toHaveLength(2);
  });

  it("subtracts blocked and assigned from the override ceiling, matching inventory cells", () => {
    const beds = executiveBeds();
    const blocks = [{ bedId: 1, dormId: 2, startDate: "2026-08-31", endDate: "2026-09-01" }];
    const assignments = [{ dormId: 2, checkinDate: "2026-08-31", checkoutDate: "2026-09-01", status: "assigned" }];
    const overrides = [{ dormId: 2, date: "2026-08-31", onlineAvailable: 5, channelId: null }];
    expect(inventoryAvailableForNight(2, "2026-08-31", beds, blocks, assignments, overrides)).toBe(3);
  });

  it("without an override, returns all physically free beds", () => {
    const beds = executiveBeds();
    const physical = beds.slice(0, 10);
    const capped = capPhysicalBedsToInventory(physical, beds, ["2026-08-31"], [], [], []);
    expect(capped).toHaveLength(10);
  });

  it("allows assigning any physically free beds up to the inventory cap", () => {
    const beds = executiveBeds();
    const physicalIds = new Set(beds.map((b) => b.id));
    const overrides = [{ dormId: 2, date: "2026-08-31", onlineAvailable: 5, channelId: null }];
    const nights = ["2026-08-31"];
    const laterFive = beds.slice(7).map((b) => ({ id: b.id, dormId: b.dormId }));
    expect(bedsFitInventoryCap(laterFive, physicalIds, nights, beds, [], [], overrides)).toBeNull();
    expect(bedsFitInventoryCap(beds.map((b) => ({ id: b.id, dormId: b.dormId })), physicalIds, nights, beds, [], [], overrides)).toBe(
      "Not enough inventory for one or more dorms on these dates",
    );
  });

  it("rejects occupied or blocked beds even when inventory still has a ceiling", () => {
    const beds = executiveBeds();
    const physicalIds = new Set(beds.slice(1).map((b) => b.id));
    const overrides = [{ dormId: 2, date: "2026-08-31", onlineAvailable: 5, channelId: null }];
    expect(bedsFitInventoryCap([{ id: 1, dormId: 2 }], physicalIds, ["2026-08-31"], beds, [], [], overrides)).toBe(
      "One or more beds are not available for these dates",
    );
  });
});

describe("New Booking inventory cap is wired through the API", () => {
  it("caps getAvailableBedsForRange with inventory overrides", () => {
    expect(queries).toContain("capPhysicalBedsToInventory(physical, allBeds, nights, blocks, assignments, overrides)");
    expect(queries).toContain("export async function validateBedsForRange");
  });

  it("rejects over-cap bed lists on create and assign before writing", () => {
    const create = route.match(/action === "createBooking"[\s\S]*?action === "assignBeds"/)![0];
    expect(create).toContain("validateBedsForRange(bedIds, checkinDate, checkoutDate)");
    expect(create.indexOf("validateBedsForRange")).toBeLessThan(create.indexOf("addBooking("));

    const assign = route.match(/action === "assignBeds"[\s\S]*?action === "checkIn"/)![0];
    expect(assign).toContain("validateBedsForRange(bedIds, checkinDate, checkoutDate)");
    expect(assign.indexOf("validateBedsForRange")).toBeLessThan(assign.indexOf("assignBedToBooking("));
  });
});
