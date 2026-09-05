import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { compareMappings, mappingFingerprint, mappingHealth } from "@/lib/aiosellMappingHealth";

const mocks = vi.hoisted(() => ({ db: null as any, sqlite: null as any, config: null as any, rooms: [] as any[], plans: [] as any[], fetch: vi.fn(), log: vi.fn() }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/db/queries", () => ({
  getChannelConfig: async () => mocks.config,
  getRoomTypeMappings: async () => mocks.rooms,
  getRatePlanMappings: async () => mocks.plans,
  getSetting: async (key: string) => mocks.sqlite.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null,
  setSetting: async (key: string, value: string) => { mocks.sqlite.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value); },
}));
vi.mock("@/lib/aiosell", () => ({ getAiosellPropertyDetails: mocks.fetch }));
vi.mock("@/lib/pmsLog", () => ({ logPmsCall: mocks.log }));
import { checkMappings, getMappingHealth } from "@/lib/aiosellMappingCheck";
import { POST } from "@/app/api/cron/aiosell-mappings/route";
import { NextRequest } from "next/server";

const remote = { hotel_id: "hotel", rooms: [{ room_id: "room", active: true, rateplans: [{ rateplan_id: "ep" }] }] };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-05T03:30:00Z"));
  mocks.sqlite = new Database(":memory:");
  mocks.sqlite.exec("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, sync_updated_at TEXT, sync_source TEXT DEFAULT 'cloudflare')");
  mocks.db = drizzle(mocks.sqlite);
  mocks.config = { isActive: 1, apiBaseUrl: "https://example.com", hotelCode: "hotel", pmsId: "partner", apiUsername: "user", apiPassword: "secret" };
  mocks.rooms = [{ id: 1, dormId: 1, dormName: "Dorm", channelRoomCode: "room", isActive: 1 }];
  mocks.plans = [{ id: 1, roomMappingId: 1, ratePlanCode: "ep", isActive: 1 }];
  mocks.fetch.mockReset().mockResolvedValue({ success: true, details: remote });
  mocks.log.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { mocks.sqlite.close(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("mapping comparison", () => {
  it("ignores names, counts, ordering and inactive local mappings", () => {
    expect(compareMappings({ ...remote, rooms: [{ ...remote.rooms[0], room_name: "Renamed", count: 100 }] }, mocks.rooms, mocks.plans)).toEqual([]);
    expect(mappingFingerprint([...mocks.rooms].reverse(), mocks.plans)).toBe(mappingFingerprint(mocks.rooms, mocks.plans));
  });
  it("reports missing, inactive and extra rooms without duplicating child issues", () => {
    expect(compareMappings({ hotel_id: "hotel", rooms: [{ room_id: "room", active: false }, { room_id: "extra" }] }, mocks.rooms, mocks.plans).map((i) => i.kind)).toEqual(["inactive-room", "extra-room"]);
    expect(compareMappings({ hotel_id: "hotel", rooms: [] }, mocks.rooms, mocks.plans).map((i) => i.kind)).toEqual(["missing-room"]);
  });
  it("compares plans under their own room and ignores inactive local plans", () => {
    const details = { hotel_id: "hotel", rooms: [{ room_id: "room", rateplans: [{ rateplan_id: "cp" }] }, { room_id: "other", rateplans: [{ rateplan_id: "ep" }] }] };
    const issues = compareMappings(details, mocks.rooms, mocks.plans);
    expect(issues.map((i) => i.kind)).toEqual(["missing-plan", "extra-plan", "extra-room"]);
    expect(issues[0]).toMatchObject({ roomCode: "room", planCode: "ep", planId: 1 });
    expect(compareMappings(remote, mocks.rooms, [{ ...mocks.plans[0], isActive: 0 }])[0].kind).toBe("extra-plan");
  });
});

describe("stored daily mapping checks", () => {
  it("fetches once per IST day, including concurrent invocations, using real SQLite claims", async () => {
    const results = await Promise.all([checkMappings("daily"), checkMappings("daily")]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(results.some((r) => r.skipped === "busy")).toBe(true);
    expect((await checkMappings("daily")).skipped).toBe("already-checked");
    vi.setSystemTime(new Date("2026-09-05T18:30:00Z"));
    await checkMappings("daily");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("allows explicit rechecks, preserves failed findings, and clears on a verified match", async () => {
    mocks.fetch.mockResolvedValueOnce({ success: true, details: { hotel_id: "hotel", rooms: [] } });
    const mismatch = await checkMappings("daily");
    expect(mismatch.health.status).toBe("mismatch");
    mocks.fetch.mockResolvedValueOnce({ success: false, message: "private connection error" });
    const failed = await checkMappings("manual");
    expect(failed.health.status).toBe("failed");
    expect(failed.health.report?.issues).toEqual(mismatch.health.report?.issues);
    expect(JSON.stringify(failed)).not.toContain("private connection error");
    expect((await checkMappings("manual")).health.status).toBe("match");
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
  it("never fetches during dashboard reads; mapping edits invalidate an old match", async () => {
    await checkMappings("manual");
    mocks.plans[0].ratePlanCode = "new-code";
    expect((await getMappingHealth()).status).toBe("changed");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.config.hotelCode = "another-hotel";
    expect(await getMappingHealth()).toEqual({ status: "pending", report: null });
  });
  it("does not show a match if mappings change while the fetch is running", async () => {
    mocks.fetch.mockImplementationOnce(async () => { mocks.rooms[0].channelRoomCode = "replacement"; return { success: true, details: remote }; });
    expect((await checkMappings("manual")).health.status).toBe("changed");
  });
  it("skips disabled integrations and marks old checks stale", async () => {
    mocks.config.isActive = 0;
    expect((await checkMappings("daily")).skipped).toBe("disabled");
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.config.isActive = 1;
    const { health } = await checkMappings("manual");
    expect(mappingHealth(health.report, health.report!.identity, health.report!.fingerprint, Date.now() + 49 * 3600000).status).toBe("stale");
  });
  it("records failed attempts once daily and recovers an expired lock", async () => {
    mocks.sqlite.prepare("INSERT INTO settings(key,value) VALUES (?,?)").run("aiosell_mapping_check_lock", String(Date.now() - 1));
    mocks.fetch.mockRejectedValueOnce(new Error("timeout"));
    expect((await checkMappings("daily")).health.status).toBe("failed");
    expect((await checkMappings("daily")).skipped).toBe("already-checked");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("requires the cron secret before any check", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect((await POST(new NextRequest("https://local/api/cron/aiosell-mappings", { method: "POST" }))).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect((await POST(new NextRequest("https://local/api/cron/aiosell-mappings", { method: "POST", headers: { authorization: "Bearer cron-secret" } }))).status).toBe(200);
  });
});
