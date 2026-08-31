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
  getUnassignedOtaRoomCountForDorm: vi.fn(),
}));

const pushInventory = vi.hoisted(() => vi.fn());

vi.mock("@/db/queries", () => queryMocks);
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: async () => [{ count: 12 }],
      }),
    }),
  })),
}));
vi.mock("@/lib/aiosell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiosell")>();
  return {
    ...actual,
    pushInventory,
    pushRates: vi.fn(),
    pushRateRestrictions: vi.fn(),
    pushInventoryRestrictions: vi.fn(),
  };
});
vi.mock("@/lib/pmsLog", () => ({
  logPmsCall: vi.fn(),
}));

import { getDateAwareAvailability, otaFingerprint, pushIfOtaChanged, triggerInventoryPush } from "@/lib/aiosellSync";
import { logPmsCall } from "@/lib/pmsLog";

const CONFIG = {
  isActive: 1,
  autoPushInventory: 1,
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

describe("getDateAwareAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(0);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(0);
    queryMocks.getInventoryOverrideForDormDate.mockResolvedValue(null);
    queryMocks.getUnassignedOtaRoomCountForDorm.mockResolvedValue(0);
  });

  it("is physical minus blocks minus assignments, capped by online ceiling", async () => {
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([1, 2]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(3);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(1);
    queryMocks.getInventoryOverrideForDormDate.mockResolvedValue({ onlineAvailable: 5 });
    // 12 - 2 blocked - 3 assigned = 7 physical free; ceiling 5 - 1 online assigned = 4
    expect(await getDateAwareAvailability(8, "2026-09-05")).toBe(4);
  });

  it("holds unassigned OTA rooms against the online ceiling, not physical leftover", async () => {
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([1, 2]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(3);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(1);
    queryMocks.getInventoryOverrideForDormDate.mockResolvedValue({ onlineAvailable: 5 });
    queryMocks.getUnassignedOtaRoomCountForDorm.mockResolvedValue(2);
    // physical 7; ceiling 5 - 1 assigned - 2 unassigned OTA = 2
    expect(await getDateAwareAvailability(8, "2026-09-05")).toBe(2);
  });

  it("never goes below zero when everything is taken", async () => {
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([1, 2, 3, 4, 5, 6]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(10);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(9);
    expect(await getDateAwareAvailability(8, "2026-09-05")).toBe(0);
  });
});

describe("triggerInventoryPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getChannelConfig.mockResolvedValue(CONFIG);
    queryMocks.getRoomTypeMappings.mockResolvedValue(mappings);
    queryMocks.markInventoryDirty.mockResolvedValue(undefined);
    queryMocks.updateChannelSyncTime.mockResolvedValue(undefined);
    queryMocks.getDirtyInventory.mockResolvedValue([]);
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(2);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(1);
    queryMocks.getInventoryOverrideForDormDate.mockResolvedValue(null);
    queryMocks.getUnassignedOtaRoomCountForDorm.mockResolvedValue(0);
    pushInventory.mockResolvedValue({ success: true });
  });

  it("returns immediately on an empty date list without touching D1", async () => {
    await triggerInventoryPush([]);
    expect(queryMocks.getChannelConfig).not.toHaveBeenCalled();
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("marks dirty then skips Aiosell when autoPushInventory is off", async () => {
    queryMocks.getChannelConfig.mockResolvedValue({ ...CONFIG, autoPushInventory: 0 });
    await triggerInventoryPush(["2026-09-05"]);
    expect(queryMocks.markInventoryDirty).toHaveBeenCalled();
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("skips Aiosell when the channel is inactive", async () => {
    queryMocks.getChannelConfig.mockResolvedValue({ ...CONFIG, isActive: 0 });
    await triggerInventoryPush(["2026-09-05"]);
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("skips Aiosell when no room mappings exist", async () => {
    queryMocks.getRoomTypeMappings.mockResolvedValue([]);
    await triggerInventoryPush(["2026-09-05"]);
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("pushes only the affected mapped dorm", async () => {
    await triggerInventoryPush(["2026-09-05"], 8);
    expect(pushInventory).toHaveBeenCalledTimes(1);
    const updates = pushInventory.mock.calls[0][1];
    expect(updates).toEqual([{
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      rooms: [{ roomCode: "executive", available: 10 }],
    }]);
    expect(pushInventory.mock.calls[0][3]).toBe("auto");
  });

  it("does not push an unmapped dorm", async () => {
    await triggerInventoryPush(["2026-09-05"], 99);
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("clears dirty rows for the nights actually sent", async () => {
    queryMocks.getDirtyInventory.mockResolvedValue([
      { id: 1, dormId: 8, date: "2026-09-05" },
      { id: 2, dormId: 8, date: "2026-09-06" },
      { id: 3, dormId: 9, date: "2026-09-05" },
    ]);
    await triggerInventoryPush(["2026-09-05"], 8);
    expect(queryMocks.clearDirtyInventory).toHaveBeenCalledWith([1]);
  });

  it("logs inventory (auto) when push throws", async () => {
    queryMocks.getChannelConfig.mockRejectedValue(new Error("boom"));
    await triggerInventoryPush(["2026-09-05"]);
    expect(pushInventory).not.toHaveBeenCalled();
    expect(logPmsCall).toHaveBeenCalledWith(expect.objectContaining({
      type: "inventory (auto)",
      status: "failed",
    }));
  });
});

describe("pushIfOtaChanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getChannelConfig.mockResolvedValue(CONFIG);
    queryMocks.getRoomTypeMappings.mockResolvedValue(mappings);
    queryMocks.markInventoryDirty.mockResolvedValue(undefined);
    queryMocks.getDirtyInventory.mockResolvedValue([]);
    queryMocks.getBlockedBedIdsForDate.mockResolvedValue([]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(2);
    queryMocks.getOnlineAssignmentCountForDorm.mockResolvedValue(1);
    queryMocks.getInventoryOverrideForDormDate.mockResolvedValue(null);
    queryMocks.getUnassignedOtaRoomCountForDorm.mockResolvedValue(0);
    pushInventory.mockResolvedValue({ success: true });
  });

  it("does not push when the fingerprint is unchanged", async () => {
    const before = await otaFingerprint([8], ["2026-09-05"]);
    await pushIfOtaChanged(before, [8], ["2026-09-05"]);
    expect(pushInventory).not.toHaveBeenCalled();
  });

  it("pushes when availability changed", async () => {
    const before = await otaFingerprint([8], ["2026-09-05"]);
    queryMocks.getActiveAssignmentCountForDorm.mockResolvedValue(4);
    await pushIfOtaChanged(before, [8], ["2026-09-05"]);
    expect(pushInventory).toHaveBeenCalled();
  });

  it("skips empty dates or dorms", async () => {
    await pushIfOtaChanged("x", [], ["2026-09-05"]);
    await pushIfOtaChanged("x", [8], []);
    expect(pushInventory).not.toHaveBeenCalled();
  });
});
