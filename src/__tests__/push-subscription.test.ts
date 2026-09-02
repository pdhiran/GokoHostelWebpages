import { describe, expect, it } from "vitest";
import { pushSubscriptionNeedsRenewal } from "@/lib/pushSubscription";

describe("push subscription renewal", () => {
  const now = Date.UTC(2026, 8, 2);

  it("renews legacy and expired subscriptions but preserves recent ones", () => {
    expect(pushSubscriptionNeedsRenewal(0, now)).toBe(true);
    expect(pushSubscriptionNeedsRenewal(now - 31 * 24 * 60 * 60 * 1000, now)).toBe(true);
    expect(pushSubscriptionNeedsRenewal(now - 29 * 24 * 60 * 60 * 1000, now)).toBe(false);
  });
});
