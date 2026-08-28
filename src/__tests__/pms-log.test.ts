import { describe, it, expect } from "vitest";
import { serializePmsPayload, PMS_LOG_MAX_BYTES } from "@/lib/pmsLog";

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

  it("redacts secret keys nested in objects", () => {
    const raw = serializePmsPayload({
      hotelCode: "GOKO-001",
      apiPassword: "hunter2",
      webhookSecret: "shh",
      Authorization: "Basic abc",
      nested: { api_key: "xyz", rate: 1200 },
    });
    const parsed = JSON.parse(raw);
    expect(parsed.hotelCode).toBe("GOKO-001");
    expect(parsed.apiPassword).toBe("[redacted]");
    expect(parsed.webhookSecret).toBe("[redacted]");
    expect(parsed.Authorization).toBe("[redacted]");
    expect(parsed.nested.api_key).toBe("[redacted]");
    expect(parsed.nested.rate).toBe(1200);
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("shh");
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
