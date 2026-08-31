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
const pushRateRestrictions = vi.hoisted(() => vi.fn());

vi.mock("@/db/queries", () => queryMocks);
vi.mock("@/lib/aiosell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiosell")>();
  return {
    ...actual,
    pushRates,
    pushInventory: vi.fn(),
    pushRateRestrictions,
    pushInventoryRestrictions: vi.fn(),
  };
});
vi.mock("@/lib/pmsLog", () => ({
  logPmsCall: vi.fn(),
}));

import { triggerRatePush, triggerRestrictionPush } from "@/lib/aiosellSync";
import { restrictionPatch } from "@/lib/aiosell";
import { logPmsCall } from "@/lib/pmsLog";

const CONFIG = {
  isActive: 1,
  autoPushRates: 1,
  autoPushRateRestrictions: 1,
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
    pushRateRestrictions.mockResolvedValue({ success: true });
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
    expect(pushRates.mock.calls[0][2]).toBe("auto");
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

  it("logs a failed auto rate catch as rate (auto)", async () => {
    queryMocks.getChannelConfig.mockRejectedValue(new Error("boom"));
    await triggerRatePush(["2026-09-01"], [10]);
    expect(pushRates).not.toHaveBeenCalled();
    expect(logPmsCall).toHaveBeenCalledWith(expect.objectContaining({
      type: "rate (auto)",
      status: "failed",
    }));
  });
});

describe("restrictionPatch", () => {
  it("maps min stay without stopSell", () => {
    expect(restrictionPatch("minimumStay", 2)).toEqual({ minimumStay: 2 });
    expect(restrictionPatch("stopSell", true)).toEqual({ stopSell: true });
    expect(restrictionPatch("foobar", 1)).toBeNull();
  });
});

describe("triggerRestrictionPush after bulk Restrictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.getChannelConfig.mockResolvedValue(CONFIG);
    queryMocks.getRoomTypeMappings.mockResolvedValue(mappings);
    queryMocks.getRatePlanMappings.mockResolvedValue(plans);
    queryMocks.updateChannelSyncTime.mockResolvedValue(undefined);
    pushRateRestrictions.mockResolvedValue({ success: true });
  });

  it("sends only the patched field, not leftover stopSell from D1", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-08-30", stopSell: 1, minimumStay: 2, maximumStay: null, closeOnArrival: 0, closeOnDeparture: 0, minimumAdvanceReservation: null, maximumAdvanceReservation: null },
      { ratePlanId: 10, date: "2026-08-31", stopSell: 0, minimumStay: 2, maximumStay: null, closeOnArrival: 0, closeOnDeparture: 0, minimumAdvanceReservation: null, maximumAdvanceReservation: null },
    ]);

    await triggerRestrictionPush(["2026-08-30", "2026-08-31"], [10], { minimumStay: 2 });

    expect(queryMocks.getAllDailyRates).not.toHaveBeenCalled();
    expect(pushRateRestrictions).toHaveBeenCalledTimes(1);
    const updates = pushRateRestrictions.mock.calls[0][1];
    expect(updates).toEqual([
      {
        startDate: "2026-08-30",
        endDate: "2026-08-30",
        rates: [{ roomCode: "executive", rateplanCode: "executive-s-ep", restrictions: { minimumStay: 2 } }],
      },
      {
        startDate: "2026-08-31",
        endDate: "2026-08-31",
        rates: [{ roomCode: "executive", rateplanCode: "executive-s-ep", restrictions: { minimumStay: 2 } }],
      },
    ]);
    expect(JSON.stringify(updates)).not.toContain("stopSell");
    expect(pushRateRestrictions.mock.calls[0][3]).toBe("auto");
  });

  it("full snapshot still includes per-night stopSell when no patch is given", async () => {
    queryMocks.getAllDailyRates.mockResolvedValue([
      { ratePlanId: 10, date: "2026-08-30", stopSell: 1, minimumStay: 2, maximumStay: null, closeOnArrival: 0, closeOnDeparture: 0, minimumAdvanceReservation: null, maximumAdvanceReservation: null },
      { ratePlanId: 10, date: "2026-08-31", stopSell: 0, minimumStay: 2, maximumStay: null, closeOnArrival: 0, closeOnDeparture: 0, minimumAdvanceReservation: null, maximumAdvanceReservation: null },
    ]);

    await triggerRestrictionPush(["2026-08-30", "2026-08-31"], [10]);

    const updates = pushRateRestrictions.mock.calls[0][1];
    expect(updates[0].rates[0].restrictions.stopSell).toBe(true);
    expect(updates[1].rates[0].restrictions.stopSell).toBe(false);
    expect(updates[0].rates[0].restrictions.minimumStay).toBe(2);
  });

  it("does not call Aiosell when autoPushRateRestrictions is off", async () => {
    queryMocks.getChannelConfig.mockResolvedValue({ ...CONFIG, autoPushRateRestrictions: 0 });
    await triggerRestrictionPush(["2026-08-30"], [10], { minimumStay: 2 });
    expect(pushRateRestrictions).not.toHaveBeenCalled();
  });

  it("logs a failed auto restriction catch as restriction (auto)", async () => {
    queryMocks.getChannelConfig.mockRejectedValue(new Error("boom"));
    await triggerRestrictionPush(["2026-08-30"], [10], { minimumStay: 2 });
    expect(pushRateRestrictions).not.toHaveBeenCalled();
    expect(logPmsCall).toHaveBeenCalledWith(expect.objectContaining({
      type: "restriction (auto)",
      status: "failed",
    }));
  });
});
