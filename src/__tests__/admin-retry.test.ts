import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "@/components/admin/useAdminApi";

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries JSON 500 when retryServerError is on", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(500, { error: "Internal server error" }))
      .mockResolvedValueOnce(jsonRes(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithRetry("/api/admin/bookings", { method: "POST" }, {
      retries: 2,
      retryServerError: true,
    });
    await vi.runAllTimersAsync();
    const res = await pending;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry JSON 500 by default (check-in / createBooking)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(500, { error: "Internal server error" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/api/admin/checkins", { method: "POST" }, 2);
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry JSON 409 even when retryServerError is on", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(409, { error: "conflict" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/api/admin/bookings", { method: "POST" }, {
      retries: 2,
      retryServerError: true,
    });
    expect(res.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries JSON 503 always", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(503, { error: "unavailable" }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchWithRetry("/api/admin/bookings", { method: "POST" }, 2);
    await vi.runAllTimersAsync();
    const res = await pending;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
