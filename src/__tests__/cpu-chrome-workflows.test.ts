import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");
const wrapper = fs.readFileSync(path.join(ROOT, "src/components/layout/ShellWrapper.tsx"), "utf-8");

const BARE_ROUTES = ["/admin", "/self-checkin", "/food-order", "/kitchen", "/my-bills", "/review"];

function isBare(pathname: string) {
  return BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

describe("Marketing vs bare path workflows", () => {
  it("uses the same BARE_ROUTES prefix rule as ShellWrapper", () => {
    expect(wrapper).toContain('const BARE_ROUTES = ["/admin", "/self-checkin", "/food-order", "/kitchen", "/my-bills", "/review"]');
    expect(wrapper).toContain("pathname === r || pathname.startsWith(r + \"/\")");
  });

  it("keeps marketing chrome on /reviews and strips it on /review tokens", () => {
    expect(isBare("/reviews")).toBe(false);
    expect(isBare("/reviews/extra")).toBe(false);
    expect(isBare("/review")).toBe(true);
    expect(isBare("/review/abc")).toBe(true);
    expect(isBare("/review-us")).toBe(false);
  });

  it("treats nested tool routes as bare, including 404-like suffixes", () => {
    expect(isBare("/")).toBe(false);
    expect(isBare("/stay")).toBe(false);
    expect(isBare("/admin")).toBe(true);
    expect(isBare("/admin/does-not-exist")).toBe(true);
    expect(isBare("/food-order")).toBe(true);
    expect(isBare("/food-order/status")).toBe(true);
    expect(isBare("/self-checkin")).toBe(true);
    expect(isBare("/kitchen")).toBe(true);
    expect(isBare("/my-bills")).toBe(true);
    expect(isBare("/nope")).toBe(false);
  });

  it("does not double-wrap marketing errors", () => {
    const marketingError = fs.readFileSync(path.join(ROOT, "src/app/(marketing)/error.tsx"), "utf-8");
    const rootError = fs.readFileSync(path.join(ROOT, "src/app/error.tsx"), "utf-8");
    expect(marketingError).not.toContain("SiteShell");
    expect(rootError).toContain("SiteShell");
    expect(fs.readFileSync(path.join(ROOT, "src/app/(marketing)/layout.tsx"), "utf-8")).toContain("SiteShell");
    expect(fs.readFileSync(path.join(ROOT, "src/app/robots.ts"), "utf-8")).toContain('"/review/"');
    expect(fs.readFileSync(path.join(ROOT, "src/app/robots.ts"), "utf-8")).not.toMatch(/"\/review"(?!\/)/);
    expect(fs.readFileSync(path.join(ROOT, "src/app/robots.ts"), "utf-8")).not.toMatch(/"\/reviews"/);
  });

  it("uses a trailing-slash robots prefix so /reviews stays crawlable", () => {
    const blocked = (rule: string, path: string) => path.startsWith(rule);
    expect(blocked("/review", "/reviews")).toBe(true);
    expect(blocked("/review/", "/reviews")).toBe(false);
    expect(blocked("/review/", "/review/tok")).toBe(true);
  });
});
