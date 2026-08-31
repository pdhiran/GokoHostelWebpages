import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { captured, q } = vi.hoisted(() => {
  const captured: Record<string, unknown>[] = [];
  return {
    captured,
    q: {
      addChannelSyncLog: vi.fn(async (row: Record<string, unknown>) => {
        captured.push(row);
      }),
      getChannelConfig: vi.fn(),
      upsertChannelConfig: vi.fn(),
      getRoomTypeMappings: vi.fn(),
      upsertRoomTypeMapping: vi.fn(),
      deleteRoomTypeMapping: vi.fn(),
      getRatePlanMappings: vi.fn(),
      upsertRatePlanMapping: vi.fn(),
      deleteRatePlanMapping: vi.fn(),
      getDailyRates: vi.fn(),
      bulkUpsertDailyRates: vi.fn(),
      getAllDailyRates: vi.fn(),
      getChannelSyncLogs: vi.fn(),
      getAllDorms: vi.fn(),
      getAllBeds: vi.fn(),
      addBooking: vi.fn(),
      updateBookingFull: vi.fn(),
      getBookingByRef: vi.fn(),
      unassignBookingBeds: vi.fn(),
      addBookingHistoryEntry: vi.fn(),
      getBookingDetail: vi.fn(),
      checkBedAvailability: vi.fn(),
      assignBedToBooking: vi.fn(),
      updateChannelSyncTime: vi.fn(),
      getDirtyInventory: vi.fn(),
      clearDirtyInventory: vi.fn(),
      clearAllDirtyInventory: vi.fn(),
      markRatesSynced: vi.fn(),
    },
  };
});

const pushInventory = vi.hoisted(() => vi.fn());
const pushRates = vi.hoisted(() => vi.fn());
const pushRateRestrictions = vi.hoisted(() => vi.fn());
const pushInventoryRestrictions = vi.hoisted(() => vi.fn());
const pushNoShow = vi.hoisted(() => vi.fn());
const fetchFromAiosell = vi.hoisted(() => vi.fn());
const getDateAwareAvailability = vi.hoisted(() => vi.fn());
const triggerInventoryPush = vi.hoisted(() => vi.fn());

vi.mock("@/db/queries", () => q);
vi.mock("@/lib/auth", () => ({
  authenticateUser: vi.fn(),
}));
vi.mock("@/lib/aiosellSync", () => ({
  triggerInventoryPush,
  triggerRatePush: vi.fn(),
  triggerRestrictionPush: vi.fn(),
  getDateAwareAvailability,
  pushIfOtaChanged: vi.fn(),
  otaFingerprint: vi.fn(),
}));
vi.mock("@/lib/aiosell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiosell")>();
  return {
    ...actual,
    pushInventory,
    pushRates,
    pushRateRestrictions,
    pushInventoryRestrictions,
    pushNoShow,
    fetchFromAiosell,
  };
});

import { authenticateUser } from "@/lib/auth";
import { restrictionPatch } from "@/lib/aiosell";
import { POST as reservationsPOST } from "@/app/api/aiosell/reservations/route";
import { POST as channelManagerPOST } from "@/app/api/admin/channel-manager/route";
import { POST as pushInventoryPOST } from "@/app/api/aiosell/push-inventory/route";
import { POST as pushRatesPOST } from "@/app/api/aiosell/push-rates/route";
import { POST as fetchPOST } from "@/app/api/aiosell/fetch/route";
import { POST as pushNoShowPOST } from "@/app/api/aiosell/push-noshow/route";
import { POST as pushInvRestrictPOST } from "@/app/api/aiosell/push-inventory-restrictions/route";

const admin = { role: "admin" as const, displayName: "Admin", permissions: {} };
const activeConfig = {
  isActive: 1,
  hotelCode: "GOKO-001",
  webhookSecret: "whsec-test",
  pmsId: "goko-pms",
  apiBaseUrl: "https://live.aiosell.com",
  apiUsername: "aiosell",
  apiPassword: "secret",
  autoPushInventory: 1,
  autoPushRates: 1,
  autoPushRateRestrictions: 1,
};

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function adminBody(extra: Record<string, unknown> = {}) {
  return { password: "x", username: "admin", ...extra };
}

const mappings = [
  { id: 1, dormId: 8, channelRoomCode: "executive", isActive: 1 },
  { id: 2, dormId: 9, channelRoomCode: "dorm-6", isActive: 1 },
];
const plans = [
  { id: 10, roomMappingId: 1, ratePlanCode: "executive-s-ep", ratePlanName: "EP", isActive: 1 },
  { id: 11, roomMappingId: 1, ratePlanCode: "executive-s-map", ratePlanName: "MAP", isActive: 1 },
];

function bookPayload(over: Record<string, unknown> = {}) {
  return {
    action: "book" as const,
    hotelCode: "GOKO-001",
    channel: "booking.com",
    bookingId: "BK-OPS-1",
    checkin: "2026-09-05",
    checkout: "2026-09-08",
    guest: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+91000" },
    rooms: [{
      roomCode: "executive",
      rateplanCode: "executive-s-ep",
      guestName: "Ada Lovelace",
      occupancy: { adults: 1, children: 0 },
      prices: [
        { date: "2026-09-05", sellRate: 3700 },
        { date: "2026-09-06", sellRate: 3700 },
        { date: "2026-09-07", sellRate: 3700 },
      ],
    }],
    amount: { amountAfterTax: 12320, amountBeforeTax: 11000, tax: 1320, currency: "INR" },
    ...over,
  };
}

describe("restrictionPatch remaining CM keys", () => {
  it.each([
    ["closeOnArrival", true, { closeOnArrival: true }],
    ["closeOnDeparture", false, { closeOnDeparture: false }],
    ["maximumStay", 7, { maximumStay: 7 }],
    ["minimumAdvanceReservation", 2, { minimumAdvanceReservation: 2 }],
    ["maximumAdvanceReservation", 30, { maximumAdvanceReservation: 30 }],
    ["minimumStay", "", { minimumStay: null }],
    ["stopSell", 0, { stopSell: false }],
  ] as const)("%s", (key, value, expected) => {
    expect(restrictionPatch(key, value)).toEqual(expected);
  });
});

describe("Webhook auth combinations", () => {
  beforeEach(() => {
    captured.length = 0;
    for (const fn of Object.values(q)) fn.mockReset();
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getBookingByRef.mockResolvedValue(null);
    q.addBooking.mockResolvedValue(88);
    triggerInventoryPush.mockReset();
  });

  it.each([
    ["raw secret", { authorization: "whsec-test" }],
    ["Bearer", { authorization: "Bearer whsec-test" }],
    ["x-api-key", { "x-api-key": "whsec-test" }],
    ["Basic user:secret", { authorization: `Basic ${btoa("goko:whsec-test")}` }],
    ["Basic secret-only", { authorization: `Basic ${btoa("whsec-test")}` }],
  ] as const)("accepts %s", async (_label, headers) => {
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload(), headers));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalled();
  });

  it("503s when webhookSecret is empty even if CM is active", async () => {
    q.getChannelConfig.mockResolvedValue({ ...activeConfig, webhookSecret: "" });
    const res = await reservationsPOST(jsonReq(
      "http://localhost/api/aiosell/reservations",
      bookPayload(),
      { authorization: "whsec-test" },
    ));
    expect(res.status).toBe(503);
    expect(q.addBooking).not.toHaveBeenCalled();
  });
});

describe("Webhook reservation combinations", () => {
  beforeEach(() => {
    captured.length = 0;
    for (const fn of Object.values(q)) fn.mockReset();
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getBookingByRef.mockResolvedValue(null);
    q.addBooking.mockResolvedValue(88);
    q.getBookingDetail.mockResolvedValue({ assignments: [] });
    q.checkBedAvailability.mockResolvedValue(true);
    q.assignBedToBooking.mockResolvedValue(true);
    triggerInventoryPush.mockReset();
    triggerInventoryPush.mockResolvedValue(undefined);
  });

  it("stores PAH vs prepaid from the pah flag", async () => {
    await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({ pah: true }), { authorization: "whsec-test" }));
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: "pay_at_hotel" }));
    q.addBooking.mockClear();
    await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({ pah: false, bookingId: "BK-PRE" }), { authorization: "whsec-test" }));
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: "prepaid" }));
  });

  it("counts children-only occupancy and missing guest as Unknown", async () => {
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({
      bookingId: "BK-KIDS",
      guest: undefined,
      rooms: [{
        roomCode: "dorm-6",
        rateplanCode: "STD",
        occupancy: { adults: 0, children: 2 },
        prices: [{ date: "2026-09-05", sellRate: 900 }],
      }],
    }), { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      guestName: "Unknown Guest",
      persons: 2,
      nightlyRate: 900,
      source: "channel_manager",
    }));
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("Hostelworld 1-night book is unassigned and does not push", async () => {
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({
      channel: "hostelworld",
      bookingId: "HW-1",
      checkin: "2026-09-05",
      checkout: "2026-09-06",
      rooms: [{
        roomCode: "dorm-6",
        rateplanCode: "STD",
        occupancy: { adults: 1, children: 0 },
        prices: [{ date: "2026-09-05", sellRate: 800 }],
      }],
    }), { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      platform: "hostelworld",
      source: "channel_manager",
      persons: 1,
      nightlyRate: 800,
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-06",
    }));
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("empty rooms still books with persons fallback 1 and nightly 0", async () => {
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({
      bookingId: "BK-EMPTY",
      rooms: [],
      amount: { amountAfterTax: 0, amountBeforeTax: 0, tax: 0, currency: "INR" },
    }), { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      persons: 1,
      nightlyRate: 0,
      roomType: "",
    }));
  });

  it("reuses a no_show bookingRef the same way as cancelled", async () => {
    q.getBookingByRef.mockResolvedValue({ id: 12, status: "no_show", bookingRef: "BK-OPS-1" });
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload(), { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.updateBookingFull).toHaveBeenCalledWith(12, expect.objectContaining({
      status: "received",
      cancelledAt: "",
    }));
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("modify of a cancelled stay updates guest but does not move dates or beds", async () => {
    q.getBookingByRef.mockResolvedValue({
      id: 12,
      status: "cancelled",
      guestName: "Old",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-08",
      persons: 1,
    });
    q.getBookingDetail.mockResolvedValue({
      booking: { status: "cancelled" },
      assignments: [{ status: "assigned", bedId: 7, dormId: 8, checkinDate: "2026-09-05", checkoutDate: "2026-09-08" }],
    });
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({
      action: "modify",
      checkin: "2026-09-10",
      checkout: "2026-09-12",
    }), { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    const patch = q.updateBookingFull.mock.calls[0][1];
    expect(patch.guestName).toBe("Ada Lovelace");
    expect(patch).not.toHaveProperty("checkinDate");
    expect(patch).not.toHaveProperty("checkoutDate");
    expect(patch.status).toBe("cancelled");
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("modify with the same dates does not unassign", async () => {
    q.getBookingByRef.mockResolvedValue({
      id: 12,
      status: "received",
      guestName: "Ada",
      checkinDate: "2026-09-05",
      checkoutDate: "2026-09-08",
      persons: 1,
    });
    q.getBookingDetail.mockResolvedValue({
      booking: { status: "received" },
      assignments: [{
        status: "assigned", bedId: 7, dormId: 8,
        checkinDate: "2026-09-05", checkoutDate: "2026-09-08",
      }],
    });
    await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", bookPayload({ action: "modify" }), { authorization: "whsec-test" }));
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
  });

  it("cancel unknown ref succeeds without a D1 write or inventory push", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const res = await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", {
      action: "cancel", hotelCode: "GOKO-001", channel: "Direct", bookingId: "MISSING",
    }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("cancel of an unassigned stay pushes booking nights, not today", async () => {
    q.getBookingByRef.mockResolvedValue({
      id: 12, status: "received",
      checkinDate: "2026-09-05", checkoutDate: "2026-09-08",
    });
    q.getBookingDetail.mockResolvedValue({ assignments: [] });
    await reservationsPOST(jsonReq("http://localhost/api/aiosell/reservations", {
      action: "cancel", hotelCode: "GOKO-001", channel: "booking.com", bookingId: "BK-OPS-1",
    }, { authorization: "whsec-test" }));
    expect(triggerInventoryPush).toHaveBeenCalledWith(["2026-09-05", "2026-09-06", "2026-09-07"]);
  });
});

describe("Channel Manager config API", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    vi.mocked(authenticateUser).mockResolvedValue(admin);
  });

  it("refuses to enable CM without a webhook secret", async () => {
    const res = await channelManagerPOST(jsonReq("http://localhost/api/admin/channel-manager", adminBody({
      action: "saveConfig",
      config: { isActive: true, hotelCode: "GOKO-001", webhookSecret: "" },
    })));
    expect(res.status).toBe(400);
    expect(q.upsertChannelConfig).not.toHaveBeenCalled();
  });

  it("saves when inactive without a secret", async () => {
    const res = await channelManagerPOST(jsonReq("http://localhost/api/admin/channel-manager", adminBody({
      action: "saveConfig",
      config: { isActive: false, hotelCode: "GOKO-001", webhookSecret: "" },
    })));
    expect(res.status).toBe(200);
    expect(q.upsertChannelConfig).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false, hotelCode: "GOKO-001", webhookSecret: "",
    }));
  });

  it("saves when active with a webhook secret", async () => {
    const res = await channelManagerPOST(jsonReq("http://localhost/api/admin/channel-manager", adminBody({
      action: "saveConfig",
      config: { isActive: true, hotelCode: "GOKO-001", webhookSecret: "whsec-live" },
    })));
    expect(res.status).toBe(200);
    expect(q.upsertChannelConfig).toHaveBeenCalledWith(expect.objectContaining({
      isActive: true, webhookSecret: "whsec-live",
    }));
  });

  it("rejects unknown actions", async () => {
    const res = await channelManagerPOST(jsonReq("http://localhost/api/admin/channel-manager", adminBody({
      action: "pushNow",
    })));
    expect(res.status).toBe(400);
  });
});

describe("Push inventory route modes", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    vi.mocked(authenticateUser).mockResolvedValue(admin);
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getRoomTypeMappings.mockResolvedValue(mappings);
    q.getDirtyInventory.mockResolvedValue([]);
    getDateAwareAvailability.mockResolvedValue(4);
    pushInventory.mockReset();
    pushInventory.mockResolvedValue({ success: true, message: "ok" });
  });

  it("401s non-admin", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ role: "staff", displayName: "S", permissions: {} });
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody()));
    expect(res.status).toBe(401);
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("400s when CM is inactive", async () => {
    q.getChannelConfig.mockResolvedValue({ ...activeConfig, isActive: 0 });
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody()));
    expect(res.status).toBe(400);
  });

  it("400s with no room mappings", async () => {
    q.getRoomTypeMappings.mockResolvedValue([]);
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(400);
  });

  it("ranged push sends every mapped room for inclusive nights", async () => {
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-06",
    })));
    expect(res.status).toBe(200);
    const updates = pushInventory.mock.calls[0][1];
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual({
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      rooms: [
        { roomCode: "executive", available: 4 },
        { roomCode: "dorm-6", available: 4 },
      ],
    });
    const body = await res.json();
    expect(body.mode).toBe("full");
    expect(body.inventoryPushed).toBe(4);
  });

  it("incremental dirty push only sends mapped dorm/date pairs", async () => {
    q.getDirtyInventory.mockResolvedValue([
      { id: 1, dormId: 8, date: "2026-09-05" },
      { id: 2, dormId: 99, date: "2026-09-05" },
    ]);
    getDateAwareAvailability.mockResolvedValue(2);
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody()));
    expect(res.status).toBe(200);
    expect(q.clearDirtyInventory.mock.calls).toEqual([[[2]], [[1]]]);
    const updates = pushInventory.mock.calls[0][1];
    expect(updates).toEqual([{
      startDate: "2026-09-05", endDate: "2026-09-05",
      rooms: [{ roomCode: "executive", available: 2 }],
    }]);
    const body = await res.json();
    expect(body.mode).toBe("incremental");
  });

  it("fullSync clears every dirty row after a successful push", async () => {
    q.getDirtyInventory.mockResolvedValue([{ id: 9, dormId: 8, date: "2026-09-01" }]);
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05", fullSync: true,
    })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("full");
    expect(q.clearAllDirtyInventory).toHaveBeenCalled();
  });

  it("returns 502 when Aiosell rejects the update", async () => {
    pushInventory.mockResolvedValue({ success: false, message: "hotel not found" });
    const res = await pushInventoryPOST(jsonReq("http://localhost/api/aiosell/push-inventory", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(502);
    expect(q.updateChannelSyncTime).not.toHaveBeenCalled();
  });
});

describe("Push rates and fetch routes", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    vi.mocked(authenticateUser).mockResolvedValue(admin);
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getRoomTypeMappings.mockResolvedValue(mappings);
    q.getRatePlanMappings.mockResolvedValue(plans);
    q.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-09-05", rate: 9999, adult1Rate: 3700, stopSell: 1, minimumStay: 2, maximumStay: null, closeOnArrival: 0, closeOnDeparture: 0, minimumAdvanceReservation: null, maximumAdvanceReservation: null },
    ]);
    pushRates.mockReset();
    pushRateRestrictions.mockReset();
    fetchFromAiosell.mockReset();
    pushRates.mockResolvedValue({ success: true, message: "ok" });
    pushRateRestrictions.mockResolvedValue({ success: true });
    fetchFromAiosell.mockResolvedValue({ success: true, data: [] });
  });

  it("400s when the range has no daily rates", async () => {
    q.getAllDailyRates.mockResolvedValue([]);
    const res = await pushRatesPOST(jsonReq("http://localhost/api/aiosell/push-rates", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(400);
    expect(pushRates).not.toHaveBeenCalled();
  });

  it("pushes adult1Rate and skips unmapped plans", async () => {
    q.getRatePlanMappings.mockResolvedValue([
      ...plans,
      { id: 99, roomMappingId: 404, ratePlanCode: "orphan", isActive: 1 },
    ]);
    const res = await pushRatesPOST(jsonReq("http://localhost/api/aiosell/push-rates", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(200);
    const updates = pushRates.mock.calls[0][1];
    expect(updates[0].rates).toEqual([
      { roomCode: "executive", rateplanCode: "executive-s-ep", rate: 3700 },
    ]);
    expect(pushRateRestrictions).not.toHaveBeenCalled();
    expect(q.markRatesSynced).toHaveBeenCalledWith(10, "2026-09-05", "2026-09-05");
    expect(q.markRatesSynced).toHaveBeenCalledWith(11, "2026-09-05", "2026-09-05");
  });

  it("includeRestrictions sends a full snapshot after rates", async () => {
    const res = await pushRatesPOST(jsonReq("http://localhost/api/aiosell/push-rates", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05", includeRestrictions: true,
    })));
    expect(res.status).toBe(200);
    expect(pushRateRestrictions).toHaveBeenCalledTimes(1);
    const restrictions = pushRateRestrictions.mock.calls[0][1][0].rates[0].restrictions;
    expect(restrictions.stopSell).toBe(true);
    expect(restrictions.minimumStay).toBe(2);
    expect(restrictions.minimumStayArrival).toBeNull();
  });

  it("502s when rates succeed but restrictions fail", async () => {
    pushRateRestrictions.mockResolvedValue({ success: false, message: "bad restriction" });
    const res = await pushRatesPOST(jsonReq("http://localhost/api/aiosell/push-rates", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05", includeRestrictions: true,
    })));
    expect(res.status).toBe(502);
    expect(q.markRatesSynced).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 400],
    [{ type: "inventory", startDate: "2026-09-05" }, 400],
    [{ type: "bookings", startDate: "2026-09-05", endDate: "2026-09-06" }, 400],
  ])("fetch rejects incomplete body %j", async (extra, status) => {
    const res = await fetchPOST(jsonReq("http://localhost/api/aiosell/fetch", adminBody(extra as Record<string, unknown>)));
    expect(res.status).toBe(status);
    expect(fetchFromAiosell).not.toHaveBeenCalled();
  });

  it.each(["inventory", "rates", "reservation"] as const)("fetch %s is a pull through to Aiosell", async (type) => {
    fetchFromAiosell.mockResolvedValue({ success: true, data: [{ type }] });
    const res = await fetchPOST(jsonReq("http://localhost/api/aiosell/fetch", adminBody({
      type, startDate: "2026-09-05", endDate: "2026-09-07",
    })));
    expect(res.status).toBe(200);
    expect(fetchFromAiosell).toHaveBeenCalledWith(
      expect.objectContaining({ hotelCode: "GOKO-001", pmsId: "goko-pms" }),
      type,
      "2026-09-05",
      "2026-09-07",
    );
  });
});

describe("No-show and inventory-restriction routes", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    vi.mocked(authenticateUser).mockResolvedValue(admin);
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getRoomTypeMappings.mockResolvedValue(mappings);
    q.getRatePlanMappings.mockResolvedValue(plans);
    pushNoShow.mockReset();
    pushInventoryRestrictions.mockReset();
    pushNoShow.mockResolvedValue({ success: true });
    pushInventoryRestrictions.mockResolvedValue({ success: true, message: "ok" });
  });

  it("noshow requires bookingId and partner", async () => {
    const res = await pushNoShowPOST(jsonReq("http://localhost/api/aiosell/push-noshow", adminBody({ bookingId: "CM-1" })));
    expect(res.status).toBe(400);
    expect(pushNoShow).not.toHaveBeenCalled();
  });

  it("noshow 200s and forwards bookingId plus partner", async () => {
    const res = await pushNoShowPOST(jsonReq("http://localhost/api/aiosell/push-noshow", adminBody({
      bookingId: "CM-1", partner: "booking_com",
    })));
    expect(res.status).toBe(200);
    expect(pushNoShow).toHaveBeenCalledWith(
      expect.objectContaining({ hotelCode: "GOKO-001", pmsId: "goko-pms" }),
      "CM-1",
      "booking_com",
    );
  });

  it("noshow 502s when Aiosell fails", async () => {
    pushNoShow.mockResolvedValue({ success: false, message: "unknown booking" });
    const res = await pushNoShowPOST(jsonReq("http://localhost/api/aiosell/push-noshow", adminBody({
      bookingId: "CM-1", partner: "booking_com",
    })));
    expect(res.status).toBe(502);
  });

  it("room stopSell is true only when every plan on that room is stop-sold", async () => {
    q.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-09-05", stopSell: 1, minimumStay: 2, maximumStay: 5, closeOnArrival: 1, closeOnDeparture: 0, minimumAdvanceReservation: 3, maximumAdvanceReservation: 10 },
      { ratePlanId: 11, date: "2026-09-05", stopSell: 0, minimumStay: 1, maximumStay: 9, closeOnArrival: 1, closeOnDeparture: 1, minimumAdvanceReservation: 1, maximumAdvanceReservation: 20 },
    ]);
    const res = await pushInvRestrictPOST(jsonReq("http://localhost/api/aiosell/push-inventory-restrictions", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(200);
    const rooms = pushInventoryRestrictions.mock.calls[0][1][0].rooms;
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomCode).toBe("executive");
    expect(rooms[0].restrictions).toMatchObject({
      stopSell: false,
      closeOnArrival: true,
      closeOnDeparture: false,
      minimumStay: 1,
      maximumStay: 9,
      minimumAdvanceReservation: 1,
      maximumAdvanceReservation: 20,
    });
  });

  it("400s when no restriction rows exist in range", async () => {
    q.getAllDailyRates.mockResolvedValue([]);
    const res = await pushInvRestrictPOST(jsonReq("http://localhost/api/aiosell/push-inventory-restrictions", adminBody({
      startDate: "2026-09-05", endDate: "2026-09-05",
    })));
    expect(res.status).toBe(400);
    expect(pushInventoryRestrictions).not.toHaveBeenCalled();
  });
});
