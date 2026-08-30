import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  getChannelConfig: vi.fn(),
  getRoomTypeMappings: vi.fn(),
  getRatePlanMappings: vi.fn(),
  getAllDailyRates: vi.fn(),
  updateChannelSyncTime: vi.fn(),
  getActiveAssignmentCountForDorm: vi.fn(),
  getOnlineAssignmentCountForDorm: vi.fn(),
  getBlockedBedIdsForDate: vi.fn(),
  getInventoryOverrideForDormDate: vi.fn(),
  markInventoryDirty: vi.fn(),
  getDirtyInventory: vi.fn(),
  clearDirtyInventory: vi.fn(),
}));

const pushRates = vi.hoisted(() => vi.fn());

vi.mock("@/db/queries", () => queryMocks);
vi.mock("@/lib/aiosell", () => ({
  pushRates,
  pushInventory: vi.fn(),
  pushRateRestrictions: vi.fn(),
  pushInventoryRestrictions: vi.fn(),
}));
vi.mock("@/lib/pmsLog", () => ({
  logPmsCall: vi.fn(),
}));

import { triggerRatePush } from "@/lib/aiosellSync";

const CONFIG = {
  isActive: 1,
  autoPushRates: 1,
  hotelCode: "GOKO-001",
  pmsId: "goko-pms",
  apiBaseUrl: "https://live.aiosell.com",
  apiUsername: "aiosell",
  apiPassword: "secret",
};

const mappings = [
  { id: 1, dormId: 8, channelRoomCode: "executive", isActive: 1 },
  { id: 2, dormId: 9, channelRoomCode: "dorm-6", isActive: 1 },
];

const plans = [
  { id: 10, roomMappingId: 1, ratePlanCode: "executive-s-ep", isActive: 1 },
  { id: 11, roomMappingId: 1, ratePlanCode: "executive-s-map", isActive: 1 },
  { id: 20, roomMappingId: 2, ratePlanCode: "dorm-6-ep", isActive: 1 },
];

describe("triggerRatePush after bulk Set Rates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getChannelConfig.mockResolvedValue(CONFIG);
    queryMocks.getRoomTypeMappings.mockResolvedValue(mappings);
    queryMocks.getRatePlanMappings.mockResolvedValue(plans);
    queryMocks.updateChannelSyncTime.mockResolvedValue(undefined);
    pushRates.mockResolvedValue({ success: true });
  });

  it("pushes only the selected plans, using adult1Rate, and skips the unselected room", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-09-01", rate: 999, adult1Rate: 800 },
      { ratePlanId: 11, date: "2026-09-01", rate: 800, adult1Rate: 800 },
      { ratePlanId: 20, date: "2026-09-01", rate: 500, adult1Rate: 500 },
    ]);

    await triggerRatePush(["2026-09-01"], [10, 11]);

    expect(pushRates).toHaveBeenCalledTimes(1);
    const updates = pushRates.mock.calls[0][1];
    expect(updates).toEqual([{
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      rates: [
        { roomCode: "executive", rateplanCode: "executive-s-ep", rate: 800 },
        { roomCode: "executive", rateplanCode: "executive-s-map", rate: 800 },
      ],
    }]);
    expect(JSON.stringify(updates)).not.toContain("dorm-6");
    expect(queryMocks.updateChannelSyncTime).toHaveBeenCalled();
  });

  it("one update per night when two rooms are set across two nights", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-09-01", rate: 800, adult1Rate: 800 },
      { ratePlanId: 20, date: "2026-09-01", rate: 800, adult1Rate: 800 },
      { ratePlanId: 10, date: "2026-09-02", rate: 800, adult1Rate: 800 },
      { ratePlanId: 20, date: "2026-09-02", rate: 800, adult1Rate: 800 },
    ]);

    await triggerRatePush(["2026-09-01", "2026-09-02"], [10, 20]);

    const updates = pushRates.mock.calls[0][1];
    expect(updates).toHaveLength(2);
    expect(updates[0].rates).toEqual([
      { roomCode: "executive", rateplanCode: "executive-s-ep", rate: 800 },
      { roomCode: "dorm-6", rateplanCode: "dorm-6-ep", rate: 800 },
    ]);
    expect(updates[1].startDate).toBe("2026-09-02");
    expect(updates[1].rates).toHaveLength(2);
  });

  it("falls back to rate when adult1Rate is null", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-09-01", rate: 1200, adult1Rate: null },
    ]);
    await triggerRatePush(["2026-09-01"], [10]);
    expect(pushRates.mock.calls[0][1][0].rates[0].rate).toBe(1200);
  });

  it("does not call Aiosell when autoPushRates is off", async () => {
    queryMocks.getChannelConfig.mockResolvedValue({ ...CONFIG, autoPushRates: 0 });
    await triggerRatePush(["2026-09-01"], [10, 11]);
    expect(pushRates).not.toHaveBeenCalled();
  });

  it("does not call Aiosell when the channel is inactive", async () => {
    queryMocks.getChannelConfig.mockResolvedValue({ ...CONFIG, isActive: 0 });
    await triggerRatePush(["2026-09-01"], [10]);
    expect(pushRates).not.toHaveBeenCalled();
  });

  it("skips push when no daily rows exist for the selected plans", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 20, date: "2026-09-01", rate: 500, adult1Rate: 500 },
    ]);
    await triggerRatePush(["2026-09-01"], [10]);
    expect(pushRates).not.toHaveBeenCalled();
  });
});
