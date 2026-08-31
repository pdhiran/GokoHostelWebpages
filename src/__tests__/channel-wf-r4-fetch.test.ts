import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const q = vi.hoisted(() => ({
  addChannelSyncLog: vi.fn(),
  getChannelConfig: vi.fn(),
  addBooking: vi.fn(),
  updateBookingFull: vi.fn(),
  getBookingByRef: vi.fn(),
  unassignBookingBeds: vi.fn(),
  addBookingHistoryEntry: vi.fn(),
  getBookingDetail: vi.fn(),
  checkBedAvailability: vi.fn(),
  assignBedToBooking: vi.fn(),
  getRoomTypeMappings: vi.fn(),
  getAvailableBedsForRange: vi.fn(),
}));

const triggerInventoryPush = vi.hoisted(() => vi.fn());

vi.mock("@/db/queries", () => q);
vi.mock("@/lib/aiosellSync", () => ({
  triggerInventoryPush,
  triggerRatePush: vi.fn(),
  triggerRestrictionPush: vi.fn(),
}));

import { POST as reservationsPOST, ingestFetchedReservations } from "@/app/api/aiosell/reservations/route";

const activeConfig = {
  isActive: 1,
  hotelCode: "GOKO-001",
  webhookSecret: "whsec-test",
};

const mappings = [
  { dormId: 8, channelRoomCode: "executive", isActive: 1, dormName: "Executive" },
  { dormId: 9, channelRoomCode: "dorm-6", isActive: 1, dormName: "Dorm 1" },
];

function webhookReq(body: unknown) {
  return new NextRequest("http://localhost/api/aiosell/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: "whsec-test" },
    body: JSON.stringify(body),
  });
}

function bookPayload(over: Record<string, unknown> = {}) {
  return {
    action: "book" as const,
    hotelCode: "GOKO-001",
    channel: "booking.com",
    bookingId: "BK-R4-1",
    checkin: "2026-09-05",
    checkout: "2026-09-08",
    guest: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "+91000" },
    rooms: [{
      roomCode: "executive",
      rateplanCode: "executive-s-ep",
      guestName: "Ada Lovelace",
      occupancy: { adults: 2, children: 0 },
      prices: [
        { date: "2026-09-05", sellRate: 3700 },
        { date: "2026-09-06", sellRate: 3700 },
        { date: "2026-09-07", sellRate: 3700 },
      ],
    }],
    amount: { amountAfterTax: 11100, amountBeforeTax: 11100, tax: 0, currency: "INR" },
    ...over,
  };
}

function existingRow(over: Record<string, unknown> = {}) {
  return {
    id: 9,
    bookingRef: "BK-R4-1",
    guestName: "Ada Lovelace",
    contact: "+91000",
    platform: "booking.com",
    status: "received",
    checkinDate: "2026-09-05",
    checkoutDate: "2026-09-08",
    roomType: "executive",
    persons: 2,
    paymentStatus: "prepaid",
    specialRequests: "",
    amountBeforeTax: 0,
    amountTax: 0,
    amountTotal: 0,
    currency: "INR",
    email: "ada@example.com",
    cmBookingId: "",
    ratePlan: "executive-s-ep",
    nightlyRate: 3700,
    ...over,
  };
}

function assigned(bedId: number, dormId: number, pool: "online" | "offline" = "online") {
  return {
    bedId, dormId, status: "assigned" as const,
    checkinDate: "2026-09-05", checkoutDate: "2026-09-08", inventoryPool: pool,
  };
}

function online(dormId: number, ids: number[], dormName: string) {
  return ids.map((id) => ({
    id,
    bedId: `${dormName}-${id}`,
    dormId,
    dormName,
    pool: "online" as const,
  }));
}

function fatCancel(bookingId: string) {
  return bookPayload({
    action: "cancel",
    bookingId,
  });
}

describe("Round 4 fetch ingest: cancel skip / modify-unknown create / mixed batch", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getBookingByRef.mockResolvedValue(null);
    q.addBooking.mockResolvedValue(42);
    q.updateBookingFull.mockResolvedValue(undefined);
    q.unassignBookingBeds.mockResolvedValue(undefined);
    q.addBookingHistoryEntry.mockResolvedValue(undefined);
    q.getBookingDetail.mockResolvedValue({ assignments: [] });
    q.checkBedAvailability.mockResolvedValue(true);
    q.assignBedToBooking.mockResolvedValue(true);
    q.getAvailableBedsForRange.mockResolvedValue(online(8, [7, 8], "Executive"));
    q.getRoomTypeMappings.mockResolvedValue(mappings);
    q.addChannelSyncLog.mockResolvedValue(undefined);
    triggerInventoryPush.mockReset();
    triggerInventoryPush.mockResolvedValue(undefined);
  });

  it("unknown cancel snapshot is skipped (imported 0, no addBooking)", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const result = await ingestFetchedReservations([
      { action: "cancel", hotelCode: "GOKO-001", channel: "booking.com", bookingId: "BK-NEVER" },
    ]);
    expect(result).toEqual({ imported: 0, skipped: 1, refs: [] });
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("mixed batch: cancel-unknown + book-unknown imports only the book", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const result = await ingestFetchedReservations([
      { action: "cancel", hotelCode: "GOKO-001", channel: "booking.com", bookingId: "BK-GHOST-CANCEL" },
      bookPayload({ bookingId: "BK-NEW-BOOK" }),
    ]);
    expect(result).toEqual({ imported: 1, skipped: 1, refs: ["BK-NEW-BOOK"] });
    expect(q.addBooking).toHaveBeenCalledTimes(1);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookingRef: "BK-NEW-BOOK",
      status: "received",
      source: "channel_manager",
    }));
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("modify snapshot of an unknown ref still ingest-creates as received", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const result = await ingestFetchedReservations([
      bookPayload({ bookingId: "BK-MOD-UNKNOWN", action: "modify" }),
    ]);
    expect(result).toEqual({ imported: 1, skipped: 0, refs: ["BK-MOD-UNKNOWN"] });
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookingRef: "BK-MOD-UNKNOWN",
      status: "received",
      source: "channel_manager",
      persons: 2,
    }));
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.addBookingHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({
      action: "Received from Channel",
    }));
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("existing cancelled ref + fetch cancel snapshot is skipped (no rebook, no update)", async () => {
    q.getBookingByRef.mockResolvedValue(existingRow({
      bookingRef: "BK-WAS-CANCELLED",
      status: "cancelled",
    }));
    const result = await ingestFetchedReservations([
      fatCancel("BK-WAS-CANCELLED"),
    ]);
    expect(result).toEqual({ imported: 0, skipped: 1, refs: [] });
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(q.assignBedToBooking).not.toHaveBeenCalled();
    expect(q.addBookingHistoryEntry).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("fetch book of unknown auto-assigns and does not triggerInventoryPush", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const result = await ingestFetchedReservations([bookPayload({ bookingId: "BK-FETCH-NEW" })]);
    expect(result).toEqual({ imported: 1, skipped: 0, refs: ["BK-FETCH-NEW"] });
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookingRef: "BK-FETCH-NEW",
      source: "channel_manager",
    }));
    expect(q.assignBedToBooking).toHaveBeenCalledTimes(2);
    expect(q.assignBedToBooking.mock.calls.every((c) =>
      c[0].bookingId === 42
      && c[0].checkinDate === "2026-09-05"
      && c[0].checkoutDate === "2026-09-08"
      && c[0].inventoryPool === "online"
      && c[0].assignedBy === "channel_manager",
    )).toBe(true);
    expect(q.getAvailableBedsForRange).toHaveBeenCalledWith("2026-09-05", "2026-09-08", undefined, 42);
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("cancel snapshot with rooms/dates still skips (action wins, no insert)", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const result = await ingestFetchedReservations([fatCancel("BK-FAT-CANCEL")]);
    expect(result).toEqual({ imported: 0, skipped: 1, refs: [] });
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("row missing action is parse-null and counted as skipped (not imported)", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const { action: _drop, ...noAction } = bookPayload({ bookingId: "BK-NO-ACTION" });
    void _drop;
    const result = await ingestFetchedReservations([
      noAction,
      bookPayload({ bookingId: "BK-HAS-ACTION" }),
    ]);
    expect(result).toEqual({ imported: 1, skipped: 1, refs: ["BK-HAS-ACTION"] });
    expect(q.getBookingByRef).not.toHaveBeenCalledWith("BK-NO-ACTION");
    expect(q.addBooking).toHaveBeenCalledTimes(1);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingRef: "BK-HAS-ACTION" }));
  });

  it("invalid action is skipped the same way as a missing action", async () => {
    const result = await ingestFetchedReservations([
      bookPayload({ bookingId: "BK-REFUND", action: "refund" }),
    ]);
    expect(result).toEqual({ imported: 0, skipped: 1, refs: [] });
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.getBookingByRef).not.toHaveBeenCalled();
  });
});

describe("Round 4 webhook vs fetch cancel / modify-unknown", () => {
  beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.getChannelConfig.mockResolvedValue(activeConfig);
    q.getBookingByRef.mockResolvedValue(null);
    q.addBooking.mockResolvedValue(42);
    q.updateBookingFull.mockResolvedValue(undefined);
    q.unassignBookingBeds.mockResolvedValue(undefined);
    q.addBookingHistoryEntry.mockResolvedValue(undefined);
    q.getBookingDetail.mockResolvedValue({ assignments: [] });
    q.checkBedAvailability.mockResolvedValue(true);
    q.assignBedToBooking.mockResolvedValue(true);
    q.getAvailableBedsForRange.mockResolvedValue(online(8, [7, 8], "Executive"));
    q.getRoomTypeMappings.mockResolvedValue(mappings);
    q.addChannelSyncLog.mockResolvedValue(undefined);
    triggerInventoryPush.mockReset();
    triggerInventoryPush.mockResolvedValue(undefined);
  });

  it("webhook cancel of unknown still succeeds with no insert", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const res = await reservationsPOST(webhookReq({
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-NEVER-SEEN",
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/not found/i);
    expect(q.addBooking).not.toHaveBeenCalled();
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("webhook cancel of existing still cancels, unassigns, and pushes (fetch cancel would skip)", async () => {
    q.getBookingByRef.mockResolvedValue(existingRow({ status: "confirmed", persons: 1 }));
    q.getBookingDetail.mockResolvedValue({ assignments: [assigned(7, 8)] });
    const hook = await reservationsPOST(webhookReq({
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-R4-1",
    }));
    expect(hook.status).toBe(200);
    expect(q.updateBookingFull).toHaveBeenCalledWith(9, expect.objectContaining({
      status: "cancelled",
      cancelledBy: "channel_manager",
    }));
    expect(q.unassignBookingBeds).toHaveBeenCalledWith(9);
    expect(triggerInventoryPush).toHaveBeenCalledWith(["2026-09-05", "2026-09-06", "2026-09-07"]);

    q.updateBookingFull.mockClear();
    q.unassignBookingBeds.mockClear();
    triggerInventoryPush.mockClear();
    q.getBookingByRef.mockResolvedValue(existingRow({ status: "confirmed", persons: 1 }));
    const fetched = await ingestFetchedReservations([
      { action: "cancel", hotelCode: "GOKO-001", channel: "booking.com", bookingId: "BK-R4-1" },
    ]);
    expect(fetched).toEqual({ imported: 0, skipped: 1, refs: [] });
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(q.unassignBookingBeds).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });

  it("webhook modify of unknown creates via handleNewBooking (upsert, no occupancy push)", async () => {
    q.getBookingByRef.mockResolvedValue(null);
    const res = await reservationsPOST(webhookReq(bookPayload({
      action: "modify",
      bookingId: "BK-WH-MOD-NEW",
    })));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toMatch(/created/i);
    expect(q.addBooking).toHaveBeenCalledWith(expect.objectContaining({
      bookingRef: "BK-WH-MOD-NEW",
      status: "received",
      source: "channel_manager",
    }));
    expect(q.assignBedToBooking).toHaveBeenCalledTimes(2);
    expect(q.updateBookingFull).not.toHaveBeenCalled();
    expect(triggerInventoryPush).not.toHaveBeenCalled();
  });
});
