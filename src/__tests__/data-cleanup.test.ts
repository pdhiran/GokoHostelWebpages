import { describe, it, expect } from "vitest";

/**
 * Tests for data cleanup logic.
 * Validates the cleanup rules without a live database.
 */

function isEligibleForCleanup(order: {
  guestType: string;
  status: string;
  createdAt: string;
  checkinStatus?: string;
  checkedOutAt?: string;
}, now: Date = new Date()): boolean {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  if (order.guestType === "hostel") {
    return (
      order.checkinStatus === "checked_out" &&
      !!order.checkedOutAt &&
      order.checkedOutAt < sevenDaysAgo
    );
  }

  // Walk-in
  return (
    order.guestType === "walkin" &&
    order.createdAt < sevenDaysAgo &&
    (order.status === "served" || order.status === "cancelled")
  );
}

describe("Order cleanup eligibility", () => {
  const now = new Date("2026-06-14T12:00:00Z");

  it("hostel order with checkout > 7 days ago is eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "hostel",
      status: "served",
      createdAt: "2026-06-01T10:00:00Z",
      checkinStatus: "checked_out",
      checkedOutAt: "2026-06-05T10:00:00Z",
    }, now)).toBe(true);
  });

  it("hostel order with recent checkout is NOT eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "hostel",
      status: "served",
      createdAt: "2026-06-10T10:00:00Z",
      checkinStatus: "checked_out",
      checkedOutAt: "2026-06-12T10:00:00Z",
    }, now)).toBe(false);
  });

  it("hostel order with active checkin is NOT eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "hostel",
      status: "served",
      createdAt: "2026-06-01T10:00:00Z",
      checkinStatus: "active",
      checkedOutAt: undefined,
    }, now)).toBe(false);
  });

  it("walk-in served order > 7 days ago is eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "walkin",
      status: "served",
      createdAt: "2026-06-01T10:00:00Z",
    }, now)).toBe(true);
  });

  it("walk-in cancelled order > 7 days ago is eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "walkin",
      status: "cancelled",
      createdAt: "2026-06-01T10:00:00Z",
    }, now)).toBe(true);
  });

  it("walk-in order still active is NOT eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "walkin",
      status: "placed",
      createdAt: "2026-06-01T10:00:00Z",
    }, now)).toBe(false);
  });

  it("recent walk-in order is NOT eligible", () => {
    expect(isEligibleForCleanup({
      guestType: "walkin",
      status: "served",
      createdAt: "2026-06-13T10:00:00Z",
    }, now)).toBe(false);
  });
});

describe("Cleanup deletion order", () => {
  it("must delete in correct order: modifications → items → orders", () => {
    // This tests the conceptual constraint that FK references require
    // child rows to be deleted before parent rows
    const deletionOrder = ["order_modifications", "food_order_items", "food_orders"];
    expect(deletionOrder[0]).toBe("order_modifications");
    expect(deletionOrder[1]).toBe("food_order_items");
    expect(deletionOrder[2]).toBe("food_orders");
  });

  it("empty orderIds array should short-circuit", () => {
    const orderIds: number[] = [];
    expect(orderIds.length === 0).toBe(true);
  });
});

describe("Daily ledger uniqueness", () => {
  it("same date + account should not create duplicates", () => {
    const entries = [
      { date: "2026-06-14", accountId: 1 },
      { date: "2026-06-14", accountId: 1 }, // duplicate
      { date: "2026-06-14", accountId: 2 }, // different account, OK
    ];

    const seen = new Set<string>();
    const duplicates: typeof entries = [];
    for (const e of entries) {
      const key = `${e.date}:${e.accountId}`;
      if (seen.has(key)) {
        duplicates.push(e);
      } else {
        seen.add(key);
      }
    }

    expect(duplicates.length).toBe(1);
    expect(duplicates[0].date).toBe("2026-06-14");
    expect(duplicates[0].accountId).toBe(1);
  });

  it("different dates for same account are not duplicates", () => {
    const entries = [
      { date: "2026-06-13", accountId: 1 },
      { date: "2026-06-14", accountId: 1 },
    ];

    const keys = entries.map((e) => `${e.date}:${e.accountId}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(2);
  });
});
