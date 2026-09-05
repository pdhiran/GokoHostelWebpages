import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), health: vi.fn(), check: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authenticateUser: mocks.auth }));
vi.mock("@/db/queries", () => ({}));
vi.mock("@/lib/aiosellMappingCheck", () => ({ getMappingHealth: mocks.health, checkMappings: mocks.check }));
import { POST } from "@/app/api/admin/channel-manager/route";
const request = (action: string) => new NextRequest("https://local/api/admin/channel-manager", { method: "POST", body: JSON.stringify({ password: "test", action }) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ role: "admin" }); mocks.health.mockResolvedValue({ status: "pending", report: null }); mocks.check.mockResolvedValue({ health: { status: "match", report: null } }); });
describe("mapping health admin actions", () => {
  it("reads stored health without initiating a check", async () => {
    expect((await POST(request("getMappingHealth"))).status).toBe(200);
    expect(mocks.health).toHaveBeenCalledTimes(1);
    expect(mocks.check).not.toHaveBeenCalled();
  });
  it("runs explicit checks as manual checks", async () => {
    expect((await POST(request("checkMappings"))).status).toBe(200);
    expect(mocks.check).toHaveBeenCalledWith("manual");
  });
  it.each(["manager", "staff"])("does not give %s access to mapping administration", async (role) => {
    mocks.auth.mockResolvedValue({ role });
    expect((await POST(request("checkMappings"))).status).toBe(401);
    expect(mocks.check).not.toHaveBeenCalled();
  });
});
