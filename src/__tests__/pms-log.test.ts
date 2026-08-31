import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { serializePmsPayload, PMS_LOG_MAX_BYTES, sqliteLikePrefix } from "@/lib/pmsLog";
import { summarizePmsLog, previousPmsPayload, pmsLogKind } from "@/lib/pmsLogSummary";

describe("serializePmsPayload", () => {
  it("returns empty string for nullish", () => {
    expect(serializePmsPayload(null)).toBe("");
    expect(serializePmsPayload(undefined)).toBe("");
    expect(serializePmsPayload("")).toBe("");
  });

  it("stringifies objects", () => {
    expect(serializePmsPayload({ hotelCode: "GOKO-001", available: 4 })).toBe(
      JSON.stringify({ hotelCode: "GOKO-001", available: 4 })
    );
  });

  it("keeps guest fields and other payload keys as sent", () => {
    const parsed = JSON.parse(serializePmsPayload({
      bookingId: "BK-1",
      guest: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "999" },
      creditCard: { number: "4111" },
    }));
    expect(parsed.bookingId).toBe("BK-1");
    expect(parsed.guest.firstName).toBe("Ada");
    expect(parsed.guest.email).toBe("ada@example.com");
    expect(parsed.guest.phone).toBe("999");
    expect(parsed.creditCard.number).toBe("4111");
  });

  it("passes through JSON strings unchanged", () => {
    const raw = '{"email":"ada@example.com","bookingId":"BK-1"}';
    expect(serializePmsPayload(raw)).toBe(raw);
  });

  it("truncates payloads over the cap and marks them", () => {
    const huge = "x".repeat(PMS_LOG_MAX_BYTES + 500);
    const out = serializePmsPayload(huge);
    expect(out.endsWith("...[truncated]")).toBe(true);
    expect(out.length).toBe(PMS_LOG_MAX_BYTES + "...[truncated]".length);
  });

  it("passes through short strings unchanged", () => {
    expect(serializePmsPayload("HTTP 400: bad request")).toBe("HTTP 400: bad request");
  });
});

describe("sqliteLikePrefix", () => {
  it("builds an escaped prefix that matches type (auto) without treating % or _ as wildcards", () => {
    expect(sqliteLikePrefix("inventory")).toBe("inventory (%");
    expect(sqliteLikePrefix("fetch")).toBe("fetch (%");
    expect(sqliteLikePrefix("rate%")).toBe("rate\\% (%");
    expect(sqliteLikePrefix("a_b")).toBe("a\\_b (%");
    expect(sqliteLikePrefix("path\\x")).toBe("path\\\\x (%");
  });

  it("getChannelSyncLogs uses the escaped prefix plus ESCAPE", () => {
    const queries = readFileSync(join(process.cwd(), "src/db/queries.ts"), "utf8");
    expect(queries).toContain("sqliteLikePrefix(filters.type)");
    expect(queries).toContain("ESCAPE");
    expect(queries).toContain("pruneChannelSyncLogs");
    expect(queries).not.toContain("LIMIT 500");
  });
});

describe("summarizePmsLog", () => {
  it("inventory push diffs available against the previous successful payload", () => {
    const prev = JSON.stringify({
      hotelCode: "sandbox-pms",
      updates: [{ startDate: "2026-08-30", endDate: "2026-08-30", rooms: [{ roomCode: "executive", available: 10 }] }],
    });
    const next = JSON.stringify({
      hotelCode: "sandbox-pms",
      updates: [{ startDate: "2026-08-30", endDate: "2026-08-30", rooms: [{ roomCode: "executive", available: 9 }] }],
    });
    expect(summarizePmsLog({ type: "inventory (auto)", requestPayload: next, previousRequestPayload: prev }))
      .toBe("executive 30 Aug 10 → 9");
  });

  it("inventory push without a previous log shows sent remaining, not a fake from", () => {
    const next = JSON.stringify({
      updates: [{ startDate: "2026-08-30", endDate: "2026-08-31", rooms: [{ roomCode: "executive", available: 9 }] }],
    });
    expect(summarizePmsLog({ type: "inventory", requestPayload: next }))
      .toBe("executive 30 Aug–31 Aug → 9");
  });

  it("rate push diffs sell rate", () => {
    const prev = JSON.stringify({
      updates: [{ startDate: "2026-09-01", endDate: "2026-09-01", rates: [{ roomCode: "executive", rateplanCode: "executive-s-ep", rate: 3700 }] }],
    });
    const next = JSON.stringify({
      updates: [{ startDate: "2026-09-01", endDate: "2026-09-01", rates: [{ roomCode: "executive", rateplanCode: "executive-s-ep", rate: 3900 }] }],
    });
    expect(summarizePmsLog({ type: "rate (auto)", requestPayload: next, previousRequestPayload: prev }))
      .toBe("executive executive-s-ep 1 Sep 3700 → 3900");
  });

  it("pull reservation summarizes book, not inventory remaining", () => {
    const body = JSON.stringify({
      action: "book",
      bookingId: "San332ee8875314",
      channel: "Mmt",
      checkin: "2026-08-31",
      checkout: "2026-09-01",
      guest: { firstName: "Ada", lastName: "Lovelace" },
      rooms: [{ roomCode: "executive", occupancy: { adults: 2, children: 0 } }],
    });
    expect(summarizePmsLog({ type: "reservation", requestPayload: body }))
      .toBe("Book · San332ee8875314 · Ada Lovelace · Mmt · 2 executive · 31 Aug–1 Sep");
  });

  it("repeated same-code rooms summarize as sold units, not occupancy × rooms", () => {
    expect(summarizePmsLog({
      type: "reservation",
      requestPayload: JSON.stringify({
        action: "book",
        bookingId: "San5c72b7455549",
        channel: "MMT",
        checkin: "2026-08-31",
        checkout: "2026-09-01",
        guest: { firstName: "Pawan 123", lastName: null },
        rooms: Array.from({ length: 6 }, () => ({
          roomCode: "suite",
          occupancy: { adults: 3, children: 0 },
        })),
      }),
    })).toBe("Book · San5c72b7455549 · Pawan 123 · MMT · 6 suite · 31 Aug–1 Sep");
  });

  it("fetch and noshow stay one line", () => {
    expect(summarizePmsLog({
      type: "fetch (reservation)",
      requestPayload: JSON.stringify({ type: "reservation", startDate: "2026-08-01", endDate: "2026-08-31" }),
    })).toBe("Fetch reservation 1 Aug–31 Aug");
    expect(summarizePmsLog({
      type: "noshow",
      requestPayload: JSON.stringify({ bookingId: "BK-1", partner: "booking.com" }),
    })).toBe("No-show · BK-1 · booking.com");
  });

  it("previousPmsPayload skips other types and failed rows", () => {
    const logs = [
      { type: "inventory (auto)", status: "success", requestPayload: '{"a":1}' },
      { type: "reservation", status: "success", requestPayload: '{"b":2}' },
      { type: "inventory", status: "failed", requestPayload: '{"c":3}' },
      { type: "inventory (auto)", status: "success", requestPayload: '{"d":4}' },
    ];
    expect(pmsLogKind("inventory (auto)")).toBe("inventory");
    expect(previousPmsPayload(logs, 0)).toBe('{"d":4}');
  });

  it("ManagementLogs renders summarizePmsLog from the previous same-kind payload", () => {
    const ui = readFileSync(join(process.cwd(), "src/components/admin/ManagementLogs.tsx"), "utf8");
    expect(ui).toContain('from "@/lib/pmsLogSummary"');
    expect(ui).not.toContain('from "@/lib/pmsLog"');
    expect(ui).toContain("summarizePmsLog");
    expect(ui).toContain("previousPmsPayload(logs, i)");
    expect(ui).toContain("LogPager");
    expect(ui).not.toContain("Newest 200");
    expect(ui).not.toContain("pruned after 500");
  });

  it("1 adult is the room code, cancel has no inventory remaining", () => {
    expect(summarizePmsLog({
      type: "reservation",
      requestPayload: JSON.stringify({
        action: "cancel",
        bookingId: "SAN-1",
        channel: "booking.com",
        checkin: "2026-09-03",
        checkout: "2026-09-04",
        rooms: [{ roomCode: "executive", occupancy: { adults: 1, children: 0 } }],
      }),
    })).toBe("Cancel · SAN-1 · booking.com · executive · 3 Sep–4 Sep");
  });

  it("inventory mixed change hides unchanged nights", () => {
    const prev = JSON.stringify({
      updates: [
        { startDate: "2026-08-30", endDate: "2026-08-31", rooms: [{ roomCode: "executive", available: 10 }] },
      ],
    });
    const next = JSON.stringify({
      updates: [
        { startDate: "2026-08-30", endDate: "2026-08-30", rooms: [{ roomCode: "executive", available: 9 }] },
        { startDate: "2026-08-31", endDate: "2026-08-31", rooms: [{ roomCode: "executive", available: 10 }] },
      ],
    });
    expect(summarizePmsLog({ type: "inventory (auto)", requestPayload: next, previousRequestPayload: prev }))
      .toBe("executive 30 Aug 10 → 9");
  });

  it("restriction snapshot of open rooms is open, not a wall of stopSell off", () => {
    const snap = (stopSell: boolean) => JSON.stringify({
      updates: [{
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        rooms: [{
          roomCode: "executive",
          restrictions: {
            stopSell,
            minimumStay: 1,
            maximumStay: null,
            closeOnArrival: false,
            closeOnDeparture: false,
            minimumAdvanceReservation: null,
            maximumAdvanceReservation: null,
            minimumStayArrival: null,
            maximumStayArrival: null,
            exactStayArrival: null,
          },
        }],
      }],
    });
    expect(summarizePmsLog({ type: "restriction", requestPayload: snap(false) }))
      .toBe("executive 1 Sep → open");
    expect(summarizePmsLog({
      type: "restriction (auto)",
      requestPayload: JSON.stringify({
        updates: [{ startDate: "2026-09-01", endDate: "2026-09-01", rooms: [{ roomCode: "executive", restrictions: { stopSell: true } }] }],
      }),
      previousRequestPayload: snap(false),
    })).toBe("executive 1 Sep open → stopSell");
  });

  it("invalid JSON request has no summary", () => {
    expect(summarizePmsLog({ type: "inventory", requestPayload: "{not-json" })).toBe("");
  });
});
