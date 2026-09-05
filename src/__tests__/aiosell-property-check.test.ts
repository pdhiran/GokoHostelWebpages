import { afterEach, describe, expect, it, vi } from "vitest";
const log = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/pmsLog", () => ({ logPmsCall: log }));
import { getAiosellPropertyDetails } from "@/lib/aiosell";
const config = { hotelCode: "hotel", pmsId: "partner", apiBaseUrl: "https://example.com", apiUsername: "user", apiPassword: "test-password" };
afterEach(() => { vi.unstubAllGlobals(); log.mockClear(); });
describe("remote mapping response validation", () => {
  it.each([
    { hotel_id: "wrong-hotel", rooms: [] },
    { hotel_id: "hotel", rooms: [{ room_id: 12 }] },
    { hotel_id: "hotel", rooms: [{ room_id: "room", rateplans: "bad" }] },
    { hotel_id: "hotel", rooms: [null] },
  ])("rejects malformed or wrong-property data", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    expect((await getAiosellPropertyDetails(config, "daily")).success).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", type: "fetch (mapping daily)" }));
  });
  it("accepts an empty valid property as a real comparison and sets a timeout", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hotel_id: "hotel", rooms: [] })));
    vi.stubGlobal("fetch", fetch);
    expect((await getAiosellPropertyDetails(config, "manual")).success).toBe(true);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ type: "fetch (mapping manual)" }));
  });
});
