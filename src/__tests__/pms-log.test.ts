import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { serializePmsPayload, PMS_LOG_MAX_BYTES, sqliteLikePrefix } from "@/lib/pmsLog";

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
  });
});
