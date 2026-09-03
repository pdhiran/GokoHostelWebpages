import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("double bed support", () => {
  it("creates two lower beds per double unit and exposes the layout in setup", () => {
    const route = readFileSync("src/app/api/admin/checkins/route.ts", "utf8");
    const setup = readFileSync("src/components/admin/AdminSetup.tsx", "utf8");

    expect(route).toContain('bedType === "Double"');
    expect(route.match(/position: "Lower", type: "Double"/g)).toHaveLength(2);
    expect(setup).toContain('<option value="Double">Double bed (2 lower)</option>');
  });
});
