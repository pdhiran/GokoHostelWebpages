import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authenticateUser, getCheckinsByMonth, getMonthKey } = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  getCheckinsByMonth: vi.fn(),
  getMonthKey: vi.fn(() => "2026-08"),
}));

vi.mock("@/lib/auth", () => ({
  authenticateUser,
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/runtime", () => ({ isOfflineMode: () => false }));
vi.mock("@/lib/googleApiFetch", () => ({ driveDeleteFile: vi.fn() }));
vi.mock("@/lib/aiosellSync", () => ({ triggerInventoryPush: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/queries", () => ({
  getCheckinsByMonth,
  addCheckin: vi.fn(),
  updateCheckin: vi.fn(),
  deleteCheckin: vi.fn(),
  getCheckinMonths: vi.fn(),
  markVibeMatched: vi.fn(),
  getAllBeds: vi.fn(),
  getBedById: vi.fn(),
  updateBedStatus: vi.fn(),
  getAllDorms: vi.fn(),
  getDormByName: vi.fn(),
  addDorm: vi.fn(),
  addBed: vi.fn(),
  deleteBed: vi.fn(),
  deleteDormAndBeds: vi.fn(),
  logBedHistoryEntry: vi.fn(),
  getBedHistoryAll: vi.fn(),
  deleteBedHistoryEntry: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getAllStats: vi.fn(),
  incrementStat: vi.fn(),
  getMonthKey,
  getAllBookings: vi.fn(),
  getUpcomingBookings: vi.fn(),
  addBooking: vi.fn(),
  updateBookingStatus: vi.fn(),
  deleteBooking: vi.fn(),
  createRateScrape: vi.fn(),
  getLatestRateScrape: vi.fn(),
  getRateScrapeById: vi.fn(),
  updateRateScrape: vi.fn(),
  getAllUsers: vi.fn(),
  getUserByUsername: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  addAuditEntry: vi.fn(),
  getAuditEntries: vi.fn(),
  addSystemLog: vi.fn(),
  getSystemLogs: vi.fn(),
  createReviewRequest: vi.fn(),
  getReviewRequestByCheckinId: vi.fn(),
}));

import { POST } from "@/app/api/admin/checkins/route";
import { firstVisibleAdminSection } from "@/lib/adminNav";

const bookingsOnly = {
  role: "staff" as const,
  displayName: "Bo",
  permissions: { canViewBookings: true },
};

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/checkins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Checkins auth-vs-list workflows", () => {
  beforeEach(() => {
    authenticateUser.mockReset();
    getCheckinsByMonth.mockReset();
    getMonthKey.mockReturnValue("2026-08");
  });

  it("401s before the auth shortcut when the password is wrong", async () => {
    authenticateUser.mockResolvedValue(null);
    const res = await POST(req({ password: "nope", action: "auth" }));
    expect(res.status).toBe(401);
    expect(getCheckinsByMonth).not.toHaveBeenCalled();
  });

  it("lets bookings-only staff authenticate without loading records", async () => {
    authenticateUser.mockResolvedValue(bookingsOnly);
    const res = await POST(req({ password: "x", action: "auth" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "staff", permissions: { canViewBookings: true } });
    expect(getCheckinsByMonth).not.toHaveBeenCalled();
  });

  it("still forbids bookings-only staff from list", async () => {
    authenticateUser.mockResolvedValue(bookingsOnly);
    const res = await POST(req({ password: "x", action: "list", month: "2026-08" }));
    expect(res.status).toBe(403);
    expect(getCheckinsByMonth).not.toHaveBeenCalled();
  });

  it("loads month rows for list after a permitted login, not for auth", async () => {
    authenticateUser.mockResolvedValue({
      role: "staff",
      displayName: "Rec",
      permissions: { canViewRecords: true },
    });
    getCheckinsByMonth.mockResolvedValue([]);
    const authRes = await POST(req({ password: "x", action: "auth" }));
    expect(authRes.status).toBe(200);
    expect(getCheckinsByMonth).not.toHaveBeenCalled();

    const listRes = await POST(req({ password: "x", action: "list", month: "2026-08" }));
    expect(listRes.status).toBe(200);
    expect(getCheckinsByMonth).toHaveBeenCalledWith("2026-08");
  });
});

describe("firstVisibleAdminSection", () => {
  it("keeps the current section for admin and for staff already on an allowed tab", () => {
    expect(firstVisibleAdminSection("admin", {}, "dashboard")).toBe("dashboard");
    expect(firstVisibleAdminSection("staff", { canViewBookings: true }, "bookings")).toBe("bookings");
  });

  it("sends bookings-only staff off dashboard before the dashboard tab can mount", () => {
    expect(firstVisibleAdminSection("staff", { canViewBookings: true }, "dashboard")).toBe("bookings");
  });

  it("returns null when a non-admin has no visible sections", () => {
    expect(firstVisibleAdminSection("manager", {}, "dashboard")).toBeNull();
  });
});
