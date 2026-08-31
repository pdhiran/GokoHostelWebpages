import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { stayNightCount } from "@/lib/inventoryAvailability";
import { getNights, calculateTax } from "@/components/admin/booking-dashboard/utils";

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
  deactivateBedBlocksByBedIds: vi.fn(),
  shortenAssignedCheckout: vi.fn(),
  pushNoShow: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authenticateUser: q.authenticateUser }));
vi.mock("@/lib/aiosellSync", () => ({
  otaFingerprint: vi.fn(async () => "fp"),
  pushIfOtaChanged: vi.fn(async () => undefined),
}));
vi.mock("@/lib/aiosell", () => ({ pushNoShow: q.pushNoShow }));
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
import { pushIfOtaChanged } from "@/lib/aiosellSync";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const admin = { role: "admin" as const, displayName: "Admin", permissions: {} };

function priced(rate: number, nights: number, beds: number) {
  const before = rate * nights * beds;
  return { ...calculateTax(before), nights, beds, before };
}

function tagBeds(ids: number[], pool: "online" | "offline" = "online") {
  return ids.map((id) => ({
    id,
    bedId: `E${id}`,
    dormId: 9,
    dormName: "Executive",
    pool,
  }));
}

function mockBeds(ids: number[]) {
  q.getBedById.mockImplementation(async (id: number) => {
    if (!ids.includes(id)) return null;
    return { id, bedId: `E${id}`, dormId: 9, dormName: "Executive" };
  });
  q.getAvailableBedsForRange.mockResolvedValue(tagBeds(ids));
  q.validateBedsForRange.mockResolvedValue(null);
  q.assignBedToBooking.mockResolvedValue(true);
}

describe("Stay permutations: night math matches UI and server", () => {
  it.each([
    ["1 bed 1 night", "2026-09-05", "2026-09-06", 1],
    ["1 bed 3 nights", "2026-09-05", "2026-09-08", 3],
    ["month wrap", "2026-08-31", "2026-09-02", 2],
    ["year wrap", "2026-12-30", "2027-01-02", 3],
    ["week stay", "2026-09-01", "2026-09-08", 7],
  ] as const)("%s", (_label, ci, co, nights) => {
    expect(stayNightCount(ci, co)).toBe(nights);
    expect(getNights(ci, co)).toBe(nights);
  });

  it("UI tax for 3 people × 4 nights at ₹1000 matches server formula", () => {
    const p = priced(1000, 4, 3);
    expect(p.before).toBe(12000);
    expect(p.tax).toBe(1440);
    expect(p.total).toBe(13440);
  });
});

describe("createBooking permutations", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.authenticateUser.mockResolvedValue(admin);
    q.addBooking.mockResolvedValue(10);
    vi.mocked(pushIfOtaChanged).mockReset();
    vi.mocked(pushIfOtaChanged).mockResolvedValue(undefined);
  });

  it.each([
    ["1 bed 1 night", "2026-09-05", "2026-09-06", [7], 1000, priced(1000, 1, 1)],
    ["1 bed 4 nights", "2026-09-05", "2026-09-09", [7], 800, priced(800, 4, 1)],
    ["3 beds 1 night", "2026-09-05", "2026-09-06", [7, 8, 9], 500, priced(500, 1, 3)],
    ["2 beds 3 nights", "2026-09-05", "2026-09-08", [7, 8], 1200, priced(1200, 3, 2)],
    ["month wrap 2 beds", "2026-08-31", "2026-09-02", [7, 8], 900, priced(900, 2, 2)],
  ] as const)("%s stores persons, nights, and tax", async (_label, ci, co, beds, rate, expectAmt) => {
    mockBeds([...beds]);
    const res = await POST(req({
      password: "x",
      action: "createBooking",
      guestName: "Test",
      checkinDate: ci,
      checkoutDate: co,
      nightlyRate: rate,
      bedIds: [...beds],
    }));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      persons: beds.length,
      checkinDate: ci,
      checkoutDate: co,
      nightlyRate: rate,
      amountBeforeTax: expectAmt.before,
      amountTax: expectAmt.tax,
      amountTotal: expectAmt.total,
      source: "manual",
    }));
    expect(q.assignBedToBooking).toHaveBeenCalledTimes(beds.length);
    for (const id of beds) {
      expect(q.assignBedToBooking).toHaveBeenCalledWith(expect.objectContaining({
        bookingId: 10,
        bedId: id,
        checkinDate: ci,
        checkoutDate: co,
      }));
    }
    expect(pushIfOtaChanged).toHaveBeenCalled();
  });

  it("rejects checkout on the check-in morning (zero-night)", async () => {
    const res = await POST(req({
      password: "x",
      action: "createBooking",
      guestName: "Test",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-05",
      nightlyRate: 1000,
    }));
    expect(res.status).toBe(400);
    expect(q.addBooking).not.toHaveBeenCalled();
  });

  it("creates an unassigned walk-in when no beds are picked", async () => {
    const res = await POST(req({
      password: "x",
      action: "createBooking",
      guestName: "Walk-in",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-07",
      nightlyRate: 700,
    }));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      persons: 1,
      amountBeforeTax: 1400,
      amountTax: 168,
      amountTotal: 1568,
    }));
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
  });

  it("500s when insert returns no id", async () => {
    q.addBooking.mockResolvedValue(null);
    const res = await POST(req({
      password: "x",
      action: "createBooking",
      guestName: "Test",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-06",
    }));
    expect(res.status).toBe(500);
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
  });

  it("does not assign any bed when one of three is missing from the picker, then cancels", async () => {
    mockBeds([7, 8]);
    q.validateBedsForRange.mockResolvedValue(null);
    const res = await POST(req({
      password: "x",
      action: "createBooking",
      guestName: "Group",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-08",
      nightlyRate: 500,
      bedIds: [7, 8, 9],
    }));
    expect(res.status).toBe(409);
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
    expect(q.unassignBookingBeds).toHaveBeenCalledWith(10);
    expect(q.updateBookingFull).toHaveBeenCalledWith(10, expect.objectContaining({ status: "cancelled" }));
    expect(pushIfOtaChanged).not.toHaveBeenCalled();
  });
});

describe("assignBeds permutations", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.authenticateUser.mockResolvedValue(admin);
    vi.mocked(pushIfOtaChanged).mockReset();
    vi.mocked(pushIfOtaChanged).mockResolvedValue(undefined);
  });

  it("assigns 3 beds for a 5-night channel_manager stay on the online pool with no push", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: {
        checkinDate: "2026-09-05",
        checkoutDate: "2026-09-10",
        status: "received",
        source: "channel_manager",
      },
      assignments: [],
    });
    mockBeds([7, 8, 9]);
    const res = await POST(req({
      password: "x", action: "assignBeds", bookingId: 42, bedIds: [7, 8, 9],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assigned).toHaveLength(3);
    expect(q.assignBedToBooking).toHaveBeenCalledTimes(3);
    expect(q.assignBedToBooking).toHaveBeenCalledWith(expect.objectContaining({
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-10",
      inventoryPool: "online",
    }));
    expect(pushIfOtaChanged).not.toHaveBeenCalled();
  });

  it("409s a 2-of-3 pick without inserting any assignment", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: {
        checkinDate: "2026-09-05",
        checkoutDate: "2026-09-06",
        status: "received",
        source: "manual",
      },
      assignments: [],
    });
    mockBeds([7, 8]);
    const res = await POST(req({
      password: "x", action: "assignBeds", bookingId: 42, bedIds: [7, 8, 9],
    }));
    expect(res.status).toBe(409);
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
  });
});

describe("date change permutations", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.authenticateUser.mockResolvedValue(admin);
    q.checkBedAvailability.mockResolvedValue(true);
    vi.mocked(pushIfOtaChanged).mockReset();
    vi.mocked(pushIfOtaChanged).mockResolvedValue(undefined);
  });

  it("late check-in on a 3-night 2-bed stay shortens nights and amount", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: {
        checkinDate: "2026-09-05",
        checkoutDate: "2026-09-08",
        status: "received",
        source: "manual",
        nightlyRate: 1000,
      },
      assignments: [
        { id: 1, status: "assigned", bedId: 7, dormId: 9, checkinDate: "2026-09-05", checkoutDate: "2026-09-08", inventoryPool: "online" },
        { id: 2, status: "assigned", bedId: 8, dormId: 9, checkinDate: "2026-09-05", checkoutDate: "2026-09-08", inventoryPool: "online" },
      ],
    });
    q.assignBedToBooking.mockResolvedValue(true);
    const res = await POST(req({
      password: "x", action: "modifyCheckin", bookingId: 5, newCheckinDate: "2026-09-06",
    }));
    expect(res.status).toBe(200);
    const p = priced(1000, 2, 2);
    expect(q.updateBookingFull).toHaveBeenCalledWith(5, expect.objectContaining({
      checkinDate: "2026-09-06",
      checkoutDate: "2026-09-08",
      amountBeforeTax: p.before,
      amountTax: p.tax,
      amountTotal: p.total,
    }));
    expect(q.assignBedToBooking).toHaveBeenCalledTimes(2);
  });

  it("extend checkout on a 1-bed 1-night stay to 4 nights", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: {
        checkinDate: "2026-09-05",
        checkoutDate: "2026-09-06",
        status: "received",
        source: "manual",
        nightlyRate: 800,
      },
      assignments: [
        { id: 1, status: "assigned", bedId: 7, dormId: 9, checkinDate: "2026-09-05", checkoutDate: "2026-09-06", inventoryPool: "offline" },
      ],
    });
    q.assignBedToBooking.mockResolvedValue(true);
    const res = await POST(req({
      password: "x", action: "modifyCheckout", bookingId: 5, newCheckoutDate: "2026-09-09",
    }));
    expect(res.status).toBe(200);
    const p = priced(800, 4, 1);
    expect(q.updateBookingFull).toHaveBeenCalledWith(5, expect.objectContaining({
      checkoutDate: "2026-09-09",
      amountBeforeTax: p.before,
      amountTotal: p.total,
    }));
    expect(q.assignBedToBooking).toHaveBeenCalledWith(expect.objectContaining({
      checkoutDate: "2026-09-09",
      inventoryPool: "offline",
    }));
  });

  it("does not extend a channel_manager stay with an Aiosell occupancy push", async () => {
    q.getBookingDetail.mockResolvedValue({
      booking: {
        checkinDate: "2026-09-05",
        checkoutDate: "2026-09-06",
        status: "received",
        source: "channel_manager",
        nightlyRate: 3700,
      },
      assignments: [
        { id: 1, status: "assigned", bedId: 7, dormId: 9, checkinDate: "2026-09-05", checkoutDate: "2026-09-06", inventoryPool: "online" },
      ],
    });
    q.assignBedToBooking.mockResolvedValue(true);
    const res = await POST(req({
      password: "x", action: "modifyCheckout", bookingId: 5, newCheckoutDate: "2026-09-08",
    }));
    expect(res.status).toBe(200);
    expect(pushIfOtaChanged).not.toHaveBeenCalled();
    expect(q.assignBedToBooking).toHaveBeenCalledWith(expect.objectContaining({ inventoryPool: "online" }));
  });
});

describe("calendar nights enrichment", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.authenticateUser.mockResolvedValue(admin);
    q.getAllDorms.mockResolvedValue([]);
    q.getAllBeds.mockResolvedValue([]);
    q.getActiveBedBlocks.mockResolvedValue([]);
  });

  it("annotates 1-night, multi-night, and year-wrap stays", async () => {
    q.getBookingCalendarData.mockResolvedValue({
      bookings: [
        { id: 1, checkinDate: "2026-09-05", checkoutDate: "2026-09-06", amountTotal: 1000, amountPaid: 0 },
        { id: 2, checkinDate: "2026-09-05", checkoutDate: "2026-09-08", amountTotal: 3000, amountPaid: 500 },
        { id: 3, checkinDate: "2026-12-31", checkoutDate: "2027-01-02", amountTotal: 2000, amountPaid: 2000 },
      ],
      assignments: [],
    });
    const res = await POST(req({
      password: "x", action: "getCalendarData", startDate: "2026-09-01", endDate: "2027-01-10",
    }));
    const json = await res.json();
    expect(json.bookings[0]).toMatchObject({ nights: 1, balance: 1000 });
    expect(json.bookings[1]).toMatchObject({ nights: 3, balance: 2500 });
    expect(json.bookings[2]).toMatchObject({ nights: 2, balance: 0 });
  });
});
