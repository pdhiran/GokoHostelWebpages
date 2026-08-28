import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { captured, queryMocks } = vi.hoisted(() => {
  const captured: Record<string, unknown>[] = [];
  return {
    captured,
    queryMocks: {
      addChannelSyncLog: vi.fn(async (row: Record<string, unknown>) => {
        captured.push(row);
      }),
      getChannelConfig: vi.fn(),
      addBooking: vi.fn(),
      updateBookingFull: vi.fn(),
      getBookingByRef: vi.fn(),
      unassignBookingBeds: vi.fn(),
      addBookingHistoryEntry: vi.fn(),
      getChannelSyncLogs: vi.fn(),
      upsertChannelConfig: vi.fn(),
      getRoomTypeMappings: vi.fn(),
      upsertRoomTypeMapping: vi.fn(),
      deleteRoomTypeMapping: vi.fn(),
      getRatePlanMappings: vi.fn(),
      upsertRatePlanMapping: vi.fn(),
      deleteRatePlanMapping: vi.fn(),
      getDailyRates: vi.fn(),
      upsertDailyRate: vi.fn(),
      bulkUpsertDailyRates: vi.fn(),
      getAllDorms: vi.fn(),
      getAllBeds: vi.fn(),
    },
  };
});

vi.mock("@/db/queries", () => queryMocks);

vi.mock("@/lib/auth", () => ({
  authenticateUser: vi.fn(),
}));

vi.mock("@/lib/aiosellSync", () => ({
  triggerInventoryPush: vi.fn().mockResolvedValue(undefined),
  triggerRatePush: vi.fn().mockResolvedValue(undefined),
  triggerRestrictionPush: vi.fn().mockResolvedValue(undefined),
}));

import {
  getChannelConfig,
  addBooking,
  updateBookingFull,
  getBookingByRef,
  unassignBookingBeds,
  addBookingHistoryEntry,
  getChannelSyncLogs,
  getDailyRates,
  upsertDailyRate,
} from "@/db/queries";
import { authenticateUser } from "@/lib/auth";
import { pushInventory, pushRates, pushNoShow, type AiosellConfig } from "@/lib/aiosell";
import { POST as reservationsPOST } from "@/app/api/aiosell/reservations/route";
import { POST as channelManagerPOST } from "@/app/api/admin/channel-manager/route";
import { POST as inventoryPOST } from "@/app/api/admin/inventory/route";

const CFG: AiosellConfig = {
  hotelCode: "GOKO-001",
  pmsId: "goko-pms",
  apiBaseUrl: "https://live.aiosell.com",
  apiUsername: "aiosell",
  apiPassword: "super-secret-password",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastLog() {
  expect(captured.length).toBeGreaterThan(0);
  return captured[captured.length - 1];
}

describe("PMS outbound workflows (mocked Aiosell HTTP)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    captured.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("inventory push logs URL, full body, HTTP 200, and duration — not the API password", async () => {
    fetchMock.mockResolvedValue(jsonRes({ success: true, message: "ok" }));

    const result = await pushInventory(CFG, [{
      startDate: "2026-08-28",
      endDate: "2026-08-28",
      rooms: [
        { roomCode: "DORM-6", available: 4 },
        { roomCode: "DORM-8", available: 2 },
      ],
    }]);

    expect(result.success).toBe(true);
    const log = lastLog();
    expect(log.direction).toBe("push");
    expect(log.type).toBe("inventory");
    expect(log.status).toBe("success");
    expect(log.httpMethod).toBe("POST");
    expect(log.url).toBe("https://live.aiosell.com/api/v2/cm/update/goko-pms");
    expect(log.httpStatus).toBe(200);
    expect(log.recordsAffected).toBe(2);
    expect(typeof log.durationMs).toBe("number");
    const req = JSON.parse(log.requestPayload as string);
    expect(req.hotelCode).toBe("GOKO-001");
    expect(req.updates[0].rooms[1].available).toBe(2);
    expect(JSON.stringify(log)).not.toContain("super-secret-password");
    expect(JSON.stringify(log)).not.toMatch(/Basic /);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("/api/v2/cm/update/goko-pms");
    expect(calledInit.headers.Authorization).toMatch(/^Basic /);
  });

  it("rate push stores the actual rate rows, not a count summary", async () => {
    fetchMock.mockResolvedValue(jsonRes({ success: true }));
    await pushRates(CFG, [{
      startDate: "2026-08-28",
      endDate: "2026-08-28",
      rates: [{ roomCode: "DORM-6", rateplanCode: "STD", rate: 1200 }],
    }]);
    const log = lastLog();
    expect(log.type).toBe("rate");
    expect(log.url).toContain("/api/v2/cm/update-rates/");
    const req = JSON.parse(log.requestPayload as string);
    expect(req.updates[0].rates[0]).toEqual({ roomCode: "DORM-6", rateplanCode: "STD", rate: 1200 });
    expect(req).not.toHaveProperty("rateCount");
  });

  it("no-show push is typed and logged even when called from the dashboard path", async () => {
    fetchMock.mockResolvedValue(jsonRes({ success: true }));
    await pushNoShow(CFG, "CM-789", "booking_com");
    const log = lastLog();
    expect(log.type).toBe("noshow");
    expect(log.url).toBe("https://live.aiosell.com/api/v2/cm/noshow");
    expect(log.recordsAffected).toBe(1);
    const req = JSON.parse(log.requestPayload as string);
    expect(req).toEqual({ hotelCode: "GOKO-001", bookingId: "CM-789", partner: "booking_com" });
  });

  it("HTTP 502 logs failed with status and response snippet", async () => {
    fetchMock.mockResolvedValue(new Response("upstream dead", { status: 502 }));
    const result = await pushInventory(CFG, [{
      startDate: "2026-08-28", endDate: "2026-08-28",
      rooms: [{ roomCode: "DORM-6", available: 1 }],
    }]);
    expect(result.success).toBe(false);
    const log = lastLog();
    expect(log.status).toBe("failed");
    expect(log.httpStatus).toBe(502);
    expect(log.errorMessage).toMatch(/HTTP 502/);
    expect(log.errorMessage).toMatch(/upstream dead/);
  });

  it("Aiosell 200 with success:false is a failed PMS log, not a network error", async () => {
    fetchMock.mockResolvedValue(jsonRes({ success: false, message: "hotel not found" }));
    const result = await pushRates(CFG, [{
      startDate: "2026-08-28", endDate: "2026-08-28",
      rates: [{ roomCode: "DORM-6", rateplanCode: "STD", rate: 900 }],
    }]);
    expect(result.success).toBe(false);
    const log = lastLog();
    expect(log.status).toBe("failed");
    expect(log.httpStatus).toBe(200);
    expect(log.errorMessage).toBe("hotel not found");
  });

  it("invalid JSON on HTTP 200 keeps the HTTP status (does not look like a network drop)", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }));
    const result = await pushNoShow(CFG, "CM-1", "booking_com");
    expect(result.success).toBe(false);
    const log = lastLog();
    expect(log.status).toBe("failed");
    expect(log.httpStatus).toBe(200);
    expect(log.errorMessage).toMatch(/invalid JSON/);
  });

  it("network failure logs httpStatus 0 and does not throw", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const result = await pushInventory(CFG, [{
      startDate: "2026-08-28", endDate: "2026-08-28",
      rooms: [{ roomCode: "DORM-6", available: 1 }],
    }]);
    expect(result.success).toBe(false);
    expect(result.message).toBe("fetch failed");
    const log = lastLog();
    expect(log.status).toBe("failed");
    expect(log.httpStatus).toBe(0);
    expect(log.errorMessage).toBe("fetch failed");
  });
});

describe("PMS inbound webhook workflows", () => {
  const activeConfig = {
    isActive: 1,
    hotelCode: "GOKO-001",
    webhookSecret: "whsec-test",
  };

  function req(body: unknown, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/aiosell/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  const bookPayload = {
    action: "book" as const,
    hotelCode: "GOKO-001",
    channel: "booking.com",
    bookingId: "BK-100",
    cmBookingId: "CM-100",
    checkin: "2026-09-01",
    checkout: "2026-09-03",
    guest: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+91000" },
    rooms: [{
      roomCode: "DORM-6",
      rateplanCode: "STD",
      guestName: "Ada Lovelace",
      occupancy: { adults: 1, children: 0 },
      prices: [{ date: "2026-09-01", sellRate: 1200 }],
    }],
  };

  beforeEach(() => {
    captured.length = 0;
    vi.mocked(getChannelConfig).mockReset();
    vi.mocked(addBooking).mockReset();
    vi.mocked(updateBookingFull).mockReset();
    vi.mocked(getBookingByRef).mockReset();
    vi.mocked(unassignBookingBeds).mockReset();
    vi.mocked(addBookingHistoryEntry).mockReset();
    vi.mocked(getChannelConfig).mockResolvedValue(activeConfig as never);
    vi.mocked(getBookingByRef).mockResolvedValue(null as never);
    vi.mocked(addBooking).mockResolvedValue(undefined as never);
    vi.mocked(updateBookingFull).mockResolvedValue(undefined as never);
    vi.mocked(unassignBookingBeds).mockResolvedValue(undefined as never);
    vi.mocked(addBookingHistoryEntry).mockResolvedValue(undefined as never);
  });

  it("logs 401 without storing the presented secret", async () => {
    const res = await reservationsPOST(req(bookPayload, { authorization: "wrong-secret" }));
    expect(res.status).toBe(401);
    const log = lastLog();
    expect(log.direction).toBe("pull");
    expect(log.type).toBe("reservation");
    expect(log.status).toBe("failed");
    expect(log.httpStatus).toBe(401);
    expect(log.url).toBe("/api/aiosell/reservations");
    expect(JSON.stringify(log)).not.toContain("wrong-secret");
    expect(JSON.stringify(log)).not.toContain("whsec-test");
    expect(log.requestPayload).toBeFalsy();
  });

  it("logs invalid JSON", async () => {
    const res = await reservationsPOST(req("{not json", { authorization: "whsec-test" }));
    expect(res.status).toBe(400);
    const log = lastLog();
    expect(log.status).toBe("failed");
    expect(log.errorMessage).toBe("Invalid JSON body");
    expect(log.requestPayload).toBeFalsy();
  });

  it("logs inactive channel manager", async () => {
    vi.mocked(getChannelConfig).mockResolvedValue({ ...activeConfig, isActive: 0 } as never);
    const res = await reservationsPOST(req(bookPayload, { authorization: "whsec-test" }));
    expect(res.status).toBe(503);
    expect(lastLog().httpStatus).toBe(503);
    expect(lastLog().requestPayload).toBeFalsy();
  });

  it("logs invalid payload", async () => {
    const res = await reservationsPOST(req({ hotelCode: "GOKO-001" }, { authorization: "whsec-test" }));
    expect(res.status).toBe(400);
    expect(lastLog().errorMessage).toBe("Invalid reservation payload");
    expect(lastLog().requestPayload).toBeTruthy();
  });

  it("logs hotel code mismatch", async () => {
    const res = await reservationsPOST(req({ ...bookPayload, hotelCode: "OTHER" }, { authorization: "whsec-test" }));
    expect(res.status).toBe(400);
    expect(lastLog().errorMessage).toBe("Invalid hotel code");
  });

  it("book: one success log with request + our response, inserts a booking", async () => {
    const res = await reservationsPOST(req(bookPayload, { authorization: "Bearer whsec-test" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(addBooking).toHaveBeenCalledOnce();
    expect(captured).toHaveLength(1);
    const log = lastLog();
    expect(log.status).toBe("success");
    expect(log.httpStatus).toBe(200);
    expect(log.recordsAffected).toBe(1);
    const reqBody = JSON.parse(log.requestPayload as string);
    expect(reqBody.bookingId).toBe("BK-100");
    expect(reqBody.guest.email).toBe("[redacted]");
    expect(reqBody.guest.firstName).toBe("[redacted]");
    expect(JSON.stringify(reqBody)).not.toContain("ada@example.com");
    const respBody = JSON.parse(log.responsePayload as string);
    expect(respBody.message).toMatch(/Created Successfully/i);
  });

  it("duplicate book is still a single success log (idempotent)", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({ bookingRef: "BK-100" } as never);
    const res = await reservationsPOST(req(bookPayload, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(addBooking).not.toHaveBeenCalled();
    expect(captured).toHaveLength(1);
    expect(JSON.parse(lastLog().responsePayload as string).message).toMatch(/duplicate/i);
  });

  it("modify updates an existing booking and logs once", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({
      id: 9,
      bookingRef: "BK-100",
      guestName: "Old",
      contact: "",
      platform: "booking.com",
      status: "received",
      checkinDate: "2026-09-01",
      checkoutDate: "2026-09-03",
      roomType: "DORM-6",
      persons: 1,
      paymentStatus: "prepaid",
      specialRequests: "",
      amountBeforeTax: 0,
      amountTax: 0,
      amountTotal: 0,
      currency: "INR",
      email: "",
      cmBookingId: "",
      ratePlan: "",
      nightlyRate: 0,
    } as never);
    const res = await reservationsPOST(req({ ...bookPayload, action: "modify" }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(updateBookingFull).toHaveBeenCalledOnce();
    expect(captured).toHaveLength(1);
    expect(JSON.parse(lastLog().responsePayload as string).message).toMatch(/Modified/i);
  });

  it("cancel marks cancelled, releases beds, and logs once", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({ id: 9, bookingRef: "BK-100", status: "confirmed" } as never);
    const res = await reservationsPOST(req({
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-100",
    }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(updateBookingFull).toHaveBeenCalledWith(9, expect.objectContaining({
      status: "cancelled",
      cancelledBy: "channel_manager",
    }));
    expect(unassignBookingBeds).toHaveBeenCalledWith(9);
    expect(addBookingHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 9,
      action: "Cancelled from Channel",
    }));
    expect(captured).toHaveLength(1);
    expect(lastLog().status).toBe("success");
  });

  it("processing throw produces one failed log, not two", async () => {
    vi.mocked(addBooking).mockRejectedValue(new Error("D1 write failed"));
    const res = await reservationsPOST(req(bookPayload, { authorization: "whsec-test" }));
    expect(res.status).toBe(500);
    expect(captured).toHaveLength(1);
    expect(lastLog().status).toBe("failed");
    expect(lastLog().errorMessage).toBe("D1 write failed");
  });

  it("modify preserves existing status (does not reset to received)", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({
      id: 9,
      bookingRef: "BK-100",
      guestName: "Old",
      contact: "",
      platform: "booking.com",
      status: "confirmed",
      checkinDate: "2026-09-01",
      checkoutDate: "2026-09-03",
      roomType: "DORM-6",
      persons: 1,
      paymentStatus: "prepaid",
      specialRequests: "",
      amountBeforeTax: 0,
      amountTax: 0,
      amountTotal: 0,
      currency: "INR",
      email: "",
      cmBookingId: "",
      ratePlan: "",
      nightlyRate: 0,
    } as never);
    const res = await reservationsPOST(req({ ...bookPayload, action: "modify" }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(updateBookingFull).toHaveBeenCalledWith(9, expect.objectContaining({
      status: "confirmed",
    }));
    expect(updateBookingFull).not.toHaveBeenCalledWith(9, expect.objectContaining({
      status: "received",
    }));
  });

  it("cancel already-cancelled booking returns success without updating", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({ id: 9, bookingRef: "BK-100", status: "cancelled" } as never);
    const res = await reservationsPOST(req({
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-100",
    }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/already cancelled/i);
    expect(updateBookingFull).not.toHaveBeenCalled();
    expect(unassignBookingBeds).not.toHaveBeenCalled();
  });

  it("cancel logs history entry with correct content", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue({ id: 9, bookingRef: "BK-100", status: "confirmed" } as never);
    await reservationsPOST(req({
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-100",
    }, { authorization: "whsec-test" }));
    expect(addBookingHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 9,
      action: "Cancelled from Channel",
      details: expect.stringContaining("booking.com"),
      performedBy: "channel_manager",
    }));
  });

  it("modify creates new booking when not found (fallback to handleNewBooking)", async () => {
    vi.mocked(getBookingByRef).mockResolvedValue(null as never);
    const res = await reservationsPOST(req({ ...bookPayload, action: "modify" }, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(addBooking).toHaveBeenCalledOnce();
    expect(updateBookingFull).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.message).toMatch(/Created Successfully/i);
  });

  it("book logs history entry on successful insert", async () => {
    vi.mocked(addBooking).mockResolvedValue({ meta: { last_row_id: 42 } } as never);
    const res = await reservationsPOST(req(bookPayload, { authorization: "whsec-test" }));
    expect(res.status).toBe(200);
    expect(addBookingHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 42,
      action: "Received from Channel",
      details: expect.stringContaining("BK-100"),
      performedBy: "channel_manager",
    }));
  });
});

describe("PMS log list API", () => {
  beforeEach(() => {
    vi.mocked(authenticateUser).mockReset();
    vi.mocked(getChannelSyncLogs).mockReset();
  });

  it("admin getSyncLogs forwards limit and filters", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ role: "admin", displayName: "Admin", permissions: {} } as never);
    vi.mocked(getChannelSyncLogs).mockResolvedValue([{ id: 1, type: "inventory" }] as never);
    const res = await channelManagerPOST(new NextRequest("http://localhost/api/admin/channel-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "x",
        action: "getSyncLogs",
        limit: 200,
        direction: "push",
        type: "inventory",
        status: "failed",
      }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs).toHaveLength(1);
    expect(getChannelSyncLogs).toHaveBeenCalledWith(200, {
      direction: "push",
      type: "inventory",
      status: "failed",
    });
  });

  it("rejects non-admin", async () => {
    vi.mocked(authenticateUser).mockResolvedValue({ role: "staff", displayName: "Staff", permissions: {} } as never);
    const res = await channelManagerPOST(new NextRequest("http://localhost/api/admin/channel-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x", action: "getSyncLogs" }),
    }));
    expect(res.status).toBe(401);
    expect(getChannelSyncLogs).not.toHaveBeenCalled();
  });
});

describe("room mapping API", () => {
  beforeEach(() => {
    vi.mocked(authenticateUser).mockReset();
    vi.mocked(authenticateUser).mockResolvedValue({ role: "admin", displayName: "Admin", permissions: {} } as never);
    queryMocks.getRoomTypeMappings.mockReset();
    queryMocks.getAllDorms.mockReset();
    queryMocks.getAllBeds.mockReset();
    queryMocks.upsertRoomTypeMapping.mockReset();
    queryMocks.deleteRoomTypeMapping.mockReset();
  });

  function post(body: unknown) {
    return channelManagerPOST(new NextRequest("http://localhost/api/admin/channel-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  it("lists every dorm and overlays live names onto mappings", async () => {
    queryMocks.getRoomTypeMappings.mockResolvedValue([
      { id: 1, dormId: 5, dormName: "stale", channelRoomCode: "dorm-1", totalInventory: 12 },
    ]);
    queryMocks.getAllDorms.mockResolvedValue([
      { id: 8, name: "Shiva dorm" },
      { id: 5, name: "Dorm 1" },
    ]);
    queryMocks.getAllBeds.mockResolvedValue([
      { dormId: 5 }, { dormId: 5 }, { dormId: 8 },
    ]);
    const res = await post({ password: "x", action: "getRoomMappings" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mappings[0].dormName).toBe("Dorm 1");
    expect(body.dorms).toEqual([
      { id: 5, name: "Dorm 1", bedCount: 2 },
      { id: 8, name: "Shiva dorm", bedCount: 1 },
    ]);
  });

  it("rejects save without a room code", async () => {
    const res = await post({
      password: "x",
      action: "saveRoomMapping",
      mapping: { dormId: 8, channelRoomCode: "  " },
    });
    expect(res.status).toBe(400);
    expect(queryMocks.upsertRoomTypeMapping).not.toHaveBeenCalled();
  });

  it("rejects delete without a mapping id", async () => {
    const res = await post({ password: "x", action: "deleteRoomMapping" });
    expect(res.status).toBe(400);
    expect(queryMocks.deleteRoomTypeMapping).not.toHaveBeenCalled();
  });
});

describe("Restriction and rate adjustment workflows", () => {
  beforeEach(() => {
    vi.mocked(authenticateUser).mockReset();
    vi.mocked(authenticateUser).mockResolvedValue({ role: "admin", displayName: "Admin", permissions: {} } as never);
    queryMocks.getDailyRates.mockReset();
    queryMocks.upsertDailyRate.mockReset();
    queryMocks.upsertDailyRate.mockResolvedValue(undefined);
  });

  function post(body: unknown) {
    return inventoryPOST(new NextRequest("http://localhost/api/admin/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  it("bulkSetRestrictions preserves other fields when setting closeOnArrival", async () => {
    queryMocks.getDailyRates.mockResolvedValue([{
      id: 1,
      ratePlanId: 10,
      date: "2026-09-01",
      rate: 1500,
      stopSell: 1,
      minimumStay: 3,
      maximumStay: null,
      closeOnArrival: 0,
      closeOnDeparture: 0,
      minimumAdvanceReservation: null,
      maximumAdvanceReservation: null,
      adult1Rate: null,
      adult2Rate: null,
      childRate: null,
      infantRate: null,
      extraPersonRate: null,
    }]);
    const res = await post({
      password: "x",
      action: "bulkSetRestrictions",
      ratePlanIds: [10],
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      restrictionType: "closeOnArrival",
      value: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(1);
    expect(queryMocks.upsertDailyRate).toHaveBeenCalledWith(expect.objectContaining({
      ratePlanId: 10,
      date: "2026-09-01",
      rate: 1500,
      stopSell: 1,
      minimumStay: 3,
      closeOnArrival: 1,
    }));
  });

  it("bulkSetRestrictions rejects unknown restrictionType", async () => {
    queryMocks.getDailyRates.mockResolvedValue([{
      id: 1, ratePlanId: 10, date: "2026-09-01", rate: 1000,
      stopSell: 0, minimumStay: 1, maximumStay: null,
      closeOnArrival: 0, closeOnDeparture: 0,
      minimumAdvanceReservation: null, maximumAdvanceReservation: null,
      adult1Rate: null, adult2Rate: null, childRate: null, infantRate: null, extraPersonRate: null,
    }]);
    const res = await post({
      password: "x",
      action: "bulkSetRestrictions",
      ratePlanIds: [10],
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      restrictionType: "foobar",
      value: true,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown restrictionType/);
    expect(queryMocks.upsertDailyRate).not.toHaveBeenCalled();
  });

  it("bulkAdjustRates preserves restrictions when adjusting rate", async () => {
    queryMocks.getDailyRates.mockResolvedValue([{
      id: 1,
      ratePlanId: 10,
      date: "2026-09-01",
      rate: 1000,
      stopSell: 1,
      minimumStay: 2,
      maximumStay: 7,
      closeOnArrival: 1,
      closeOnDeparture: 0,
      minimumAdvanceReservation: null,
      maximumAdvanceReservation: null,
      adult1Rate: 900,
      adult2Rate: null,
      childRate: null,
      infantRate: null,
      extraPersonRate: null,
    }]);
    const res = await post({
      password: "x",
      action: "bulkAdjustRates",
      ratePlanIds: [10],
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      direction: "increase",
      value: 10,
      type: "percentage",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(1);
    expect(queryMocks.upsertDailyRate).toHaveBeenCalledWith(expect.objectContaining({
      ratePlanId: 10,
      date: "2026-09-01",
      rate: 1100,
      stopSell: 1,
      minimumStay: 2,
      maximumStay: 7,
      closeOnArrival: 1,
      adult1Rate: 990,
    }));
  });
});
