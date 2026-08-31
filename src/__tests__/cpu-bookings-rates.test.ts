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
  shortenAssignedCheckout: vi.fn(),
  pushNoShow: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authenticateUser: q.authenticateUser }));
vi.mock("@/lib/aiosellSync", () => ({
  otaFingerprint: vi.fn(async () => ""),
  pushIfOtaChanged: vi.fn(async () => undefined),
}));
vi.mock("@/lib/aiosell", () => ({
  pushNoShow: q.pushNoShow,
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
  shortenAssignedCheckout: q.shortenAssignedCheckout,
}));

import { POST } from "@/app/api/admin/bookings/route";
import { todayIST } from "@/lib/utils";

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

  it("early checkOut shortens assigned nights to today", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { checkinDate: "2020-01-01", checkoutDate: "2099-01-01" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7 }],
    });
    const res = await POST(req({ password: "x", action: "checkOut", bookingId: 5 }));
    expect(res.status).toBe(200);
    expect(q.shortenAssignedCheckout).toHaveBeenCalledWith(5, todayIST());
    expect(q.updateBookingFull).toHaveBeenCalledWith(5, expect.objectContaining({
      status: "checked_out",
    }));
    expect(q.updateBookingFull.mock.calls[0][1]).not.toHaveProperty("checkoutDate");
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
  });

  it("same-day checkOut keeps the assignment and cuts exclusive checkout to check-in (zero nights)", async () => {
    const today = todayIST();
    q.getBookingDetail.mockResolvedValue({
      booking: { checkinDate: today, checkoutDate: "2099-01-01" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7 }],
    });
    const res = await POST(req({ password: "x", action: "checkOut", bookingId: 5 }));
    expect(res.status).toBe(200);
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(q.shortenAssignedCheckout).toHaveBeenCalledWith(5, today);
  });

  it("rollbackCheckOut restores assignment checkout from the booking dates", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { checkinDate: "2026-08-01", checkoutDate: "2026-09-10" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7, checkoutDate: "2026-08-20" }],
    });
    q.checkBedAvailability.mockResolvedValue(true);
    const res = await POST(req({ password: "x", action: "rollbackCheckOut", bookingId: 5 }));
    expect(res.status).toBe(200);
    expect(q.checkBedAvailability).toHaveBeenCalledWith(7, "2026-08-20", "2026-09-10", 5);
    expect(q.shortenAssignedCheckout).toHaveBeenCalledWith(5, "2026-09-10");
    expect(q.updateBookingFull).toHaveBeenCalledWith(5, expect.objectContaining({ status: "checked_in" }));
  });

  it("rollbackCheckOut 409s when nights between shortened checkout and planned checkout were taken", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { checkinDate: "2026-08-01", checkoutDate: "2026-09-10" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7, checkoutDate: "2026-08-20" }],
    });
    q.checkBedAvailability.mockResolvedValue(false);
    const res = await POST(req({ password: "x", action: "rollbackCheckOut", bookingId: 5 }));
    expect(res.status).toBe(409);
    expect(q.checkBedAvailability).toHaveBeenCalledWith(7, "2026-08-20", "2026-09-10", 5);
    expect(q.shortenAssignedCheckout).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
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

  it("markNoShow notifies Aiosell when the webhook stored platform as booking.com", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { platform: "booking.com", cmBookingId: "CM-1", checkinDate: "2026-09-01", checkoutDate: "2026-09-03" },
      assignments: [{ status: "assigned", dormId: 3 }],
    });
    q.getChannelConfig.mockResolvedValue({
      isActive: 1, hotelCode: "H", pmsId: "P", apiBaseUrl: "http://x", apiUsername: "u", apiPassword: "p",
    });
    q.pushNoShow.mockResolvedValue({ success: true });
    const res = await POST(req({ password: "x", action: "markNoShow", bookingId: 5 }));
    expect(res.status).toBe(200);
    expect(q.unassignBookingBeds).toHaveBeenCalledWith(5);
    expect(q.pushNoShow).toHaveBeenCalledWith(expect.objectContaining({ hotelCode: "H" }), "CM-1", "booking_com");
  });

  it("checkIn 409s on a checked-out booking", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { status: "checked_out", checkinDate: "2026-09-01", checkoutDate: "2026-09-10" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7, checkoutDate: "2026-09-05" }],
    });
    const res = await POST(req({ password: "x", action: "checkIn", bookingId: 5 }));
    expect(res.status).toBe(409);
    expect(q.updateBookingFull).not.toHaveBeenCalled();
  });

  it("modifyCheckin 409s on a checked-out booking", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { status: "checked_out", checkinDate: "2026-09-01", checkoutDate: "2026-09-10" },
      assignments: [{ status: "assigned", dormId: 3, bedId: 7, checkoutDate: "2026-09-05" }],
    });
    const res = await POST(req({
      password: "x", action: "modifyCheckin", bookingId: 5, newCheckinDate: "2026-09-02",
    }));
    expect(res.status).toBe(409);
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
  });

  it("assignGuest does not overwrite an Aiosell cmBookingId", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { cmBookingId: "CM-99" },
      assignments: [],
    });
    const res = await POST(req({ password: "x", action: "assignGuest", bookingId: 5, checkinId: 42 }));
    expect(res.status).toBe(200);
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.addBookingHistoryEntry).toHaveBeenCalled();
  });

  it("partial cancel only releases assignments that belong to the booking", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: { checkinDate: "2026-09-01", checkoutDate: "2026-09-03" },
      assignments: [{ id: 11, status: "assigned", dormId: 3 }],
    });
    const res = await POST(req({
      password: "x", action: "cancelBooking", bookingId: 5, assignmentIds: [11, 999],
    }));
    expect(res.status).toBe(200);
    expect(q.cancelBedAssignments).toHaveBeenCalledWith([11], 5);
    expect(q.updateBookingFull).not.toHaveBeenCalled();
  });
});
