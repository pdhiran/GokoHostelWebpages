import { describe, it, expect } from "vitest";
import { parseSyncFkId } from "@/lib/syncEngine";

describe("parseSyncFkId", () => {
  it("does not coerce null/empty to 0", () => {
    expect(parseSyncFkId(null)).toBeNull();
    expect(parseSyncFkId(undefined)).toBeNull();
    expect(parseSyncFkId("")).toBeNull();
  });

  it("parses numeric ids including 0", () => {
    expect(parseSyncFkId(0)).toBe(0);
    expect(parseSyncFkId(9)).toBe(9);
    expect(parseSyncFkId("5")).toBe(5);
  });

  it("rejects non-numeric values", () => {
    expect(parseSyncFkId("dorm-1")).toBeNull();
    expect(parseSyncFkId(NaN)).toBeNull();
  });
});
