import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const q = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  getBookingCalendarData: vi.fn(),
  getBookingDetail: vi.fn(),
  searchBookings: vi.fn(),
  getUnassignedBookings: vi.fn(),
  checkBedAvailability: vi.fn(),
  getAvailableBedsForRange: vi.fn(),
  validateBedsForRange: vi.fn(),
  assignBedToBooking: vi.fn(),
  unassignBookingBeds: vi.fn(),
  cancelBedAssignments: vi.fn(),
  addBookingHistoryEntry: vi.fn(),
  getBookingHistoryEntries: vi.fn(),
  addBooking: vi.fn(),
  updateBookingFull: vi.fn(),
  getAllDorms: vi.fn(),
  getAllBeds: vi.fn(),
  getBedById: vi.fn(),
  getChannelConfig: vi.fn(),
  getActiveBedBlocks: vi.fn(),
  getRoomTypeMappings: vi.fn(),
  getRatePlanMappings: vi.fn(),
  getAllDailyRates: vi.fn(),
  getDailyRates: vi.fn(),
  deactivateBedBlocksByBedIds: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authenticateUser: q.authenticateUser }));
vi.mock("@/lib/aiosellSync", () => ({
  otaFingerprint: vi.fn(),
  pushIfOtaChanged: vi.fn(),
}));
vi.mock("@/lib/aiosell", () => ({
  pushNoShow: vi.fn(),
}));
vi.mock("@/db/queries", () => ({
  getBookingCalendarData: q.getBookingCalendarData,
  getBookingDetail: q.getBookingDetail,
  searchBookings: q.searchBookings,
  getUnassignedBookings: q.getUnassignedBookings,
  checkBedAvailability: q.checkBedAvailability,
  getAvailableBedsForRange: q.getAvailableBedsForRange,
  validateBedsForRange: q.validateBedsForRange,
  assignBedToBooking: q.assignBedToBooking,
  unassignBookingBeds: q.unassignBookingBeds,
  cancelBedAssignments: q.cancelBedAssignments,
  addBookingHistoryEntry: q.addBookingHistoryEntry,
  getBookingHistoryEntries: q.getBookingHistoryEntries,
  addBooking: q.addBooking,
  updateBookingFull: q.updateBookingFull,
  getAllDorms: q.getAllDorms,
  getAllBeds: q.getAllBeds,
  getBedById: q.getBedById,
  getChannelConfig: q.getChannelConfig,
  getActiveBedBlocks: q.getActiveBedBlocks,
  getRoomTypeMappings: q.getRoomTypeMappings,
  getRatePlanMappings: q.getRatePlanMappings,
  getAllDailyRates: q.getAllDailyRates,
  deactivateBedBlocksByBedIds: q.deactivateBedBlocksByBedIds,
}));

import { POST } from "@/app/api/admin/bookings/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const admin = { role: "admin" as const, displayName: "Admin", permissions: {} };

describe("Bookings calendar and rates workflows", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.authenticateUser.mockResolvedValue(admin);
  });

  it("rejects missing calendar dates and unknown actions", async () => {
    expect((await POST(req({ password: "x", action: "getCalendarData" }))).status).toBe(400);
    expect((await POST(req({ password: "x", action: "notARealAction" }))).status).toBe(400);
    q.authenticateUser.mockResolvedValue(null);
    expect((await POST(req({ password: "bad", action: "getAvailableBeds", checkinDate: "2026-09-01", checkoutDate: "2026-09-02" }))).status).toBe(401);
  });

  it("forbids staff without canViewBookings", async () => {
    q.authenticateUser.mockResolvedValue({
      role: "staff",
      displayName: "No",
      permissions: { canViewRecords: true },
    });
    const res = await POST(req({
      password: "x",
      action: "getAvailableBeds",
      checkinDate: "2026-09-01",
      checkoutDate: "2026-09-02",
    }));
    expect(res.status).toBe(403);
    expect(q.getAllDailyRates).not.toHaveBeenCalled();
  });

  it("enriches assignments via bed Map and keeps unknown beds empty", async () => {
    q.getBookingCalendarData.mockResolvedValue({
      bookings: [{ id: 1, checkinDate: "2026-09-01", checkoutDate: "2026-09-03", amountTotal: 1000, amountPaid: 200 }],
      assignments: [
        { id: 1, bedId: 7, bookingId: 1 },
        { id: 2, bedId: 99, bookingId: 1 },
      ],
    });
    q.getAllDorms.mockResolvedValue([{ id: 3, name: "Mixed" }]);
    q.getAllBeds.mockResolvedValue([
      { id: 7, bedId: "A1", dormId: 3, dormName: "Mixed" },
    ]);
    q.getActiveBedBlocks.mockResolvedValue([{ bedId: 7 }]);

    const res = await POST(req({
      password: "x",
      action: "getCalendarData",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.assignments[0]).toMatchObject({ dormName: "Mixed", bedLabel: "A1" });
    expect(json.assignments[1]).toMatchObject({ dormName: "", bedLabel: "" });
    expect(json.dorms[0].beds[0].isBlocked).toBe(true);
    expect(json.bookings[0]).toMatchObject({ nights: 2, balance: 800 });
    expect(json.role).toBe("admin");
    expect(json.permissions).toEqual({});
  });

  it("loads rates once and only records dorms with an active plan row", async () => {
    q.getAvailableBedsForRange.mockResolvedValue([
      { id: 1, bedId: "E1", dormId: 9, dormName: "Exec", pool: "inventory" },
    ]);
    q.getRoomTypeMappings.mockResolvedValue([
      { id: 1, dormId: 9 },
      { id: 2, dormId: 10 },
      { id: 3, dormId: 11 },
    ]);
    q.getRatePlanMappings.mockResolvedValue([
      { id: 37, roomMappingId: 1, isActive: 1 },
      { id: 38, roomMappingId: 1, isActive: 1 },
      { id: 40, roomMappingId: 2, isActive: 0 },
      { id: 41, roomMappingId: 3, isActive: 1 },
    ]);
    q.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 37, date: "2026-09-01", rate: 999, adult1Rate: 0 },
      { ratePlanId: 38, date: "2026-09-01", rate: 500, adult1Rate: 500 },
      { ratePlanId: 41, date: "2026-09-01", rate: 1200, adult1Rate: null },
    ]);

    const res = await POST(req({
      password: "x",
      action: "getAvailableBeds",
      checkinDate: "2026-09-01",
      checkoutDate: "2026-09-03",
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(q.getAllDailyRates).toHaveBeenCalledTimes(1);
    expect(q.getAllDailyRates).toHaveBeenCalledWith("2026-09-01", "2026-09-01");
    expect(q.getDailyRates).not.toHaveBeenCalled();
    expect(json.beds[0]).toMatchObject({ pool: "inventory", dormId: 9 });
    expect(json.dormRates).toEqual({ 9: 0, 11: 1200 });
    expect(json.dormRates[10]).toBeUndefined();
  });

  it("keeps the first daily-rate row per plan when duplicates appear", async () => {
    q.getAvailableBedsForRange.mockResolvedValue([]);
    q.getRoomTypeMappings.mockResolvedValue([{ id: 1, dormId: 9 }]);
    q.getRatePlanMappings.mockResolvedValue([{ id: 37, roomMappingId: 1, isActive: 1 }]);
    q.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 37, date: "2026-09-01", rate: 100, adult1Rate: 100 },
      { ratePlanId: 37, date: "2026-09-01", rate: 1, adult1Rate: 1 },
    ]);
    const json = await (await POST(req({
      password: "x",
      action: "getAvailableBeds",
      checkinDate: "2026-09-01",
      checkoutDate: "2026-09-02",
    }))).json();
    expect(json.dormRates).toEqual({ 9: 100 });
  });

  it("requires both dates for getAvailableBeds", async () => {
    const res = await POST(req({ password: "x", action: "getAvailableBeds", checkinDate: "2026-09-01" }));
    expect(res.status).toBe(400);
    expect(q.getAllDailyRates).not.toHaveBeenCalled();
  });
});
