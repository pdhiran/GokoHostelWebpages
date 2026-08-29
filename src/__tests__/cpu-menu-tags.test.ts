import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  getDb: () => {
    throw new Error("D1 should not open for an empty id list");
  },
}));

import { getMenuItemTagsByIds } from "@/db/queries";

describe("getMenuItemTagsByIds", () => {
  it("returns an empty Map without touching the database", async () => {
    await expect(getMenuItemTagsByIds([])).resolves.toEqual(new Map());
  });
});
