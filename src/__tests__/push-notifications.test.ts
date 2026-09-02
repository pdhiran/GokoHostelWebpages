import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { buildPushPayload, notificationDate, notificationFirstName, notificationFoodItems, notificationStayDates } from "@/lib/pushNotify";

const ROOT = path.resolve(__dirname, "../..");

describe("push notification payloads", () => {
  it("keeps useful content, safe admin links, and unique event identity", () => {
    const payload = buildPushPayload({
      title: "  New   Booking ",
      body: "Ada · 2026-09-05–2026-09-08",
      url: "/admin?section=bookings",
      eventId: "booking-42",
      category: "booking",
    });

    expect(payload).toMatchObject({
      title: "New Booking",
      body: "Ada · 2026-09-05–2026-09-08",
      url: "/admin?section=bookings",
      tag: "booking-booking-42",
      eventId: "booking-42",
      renotify: true,
    });
  });

  it("falls back safely and keeps recurring operational alerts quiet", () => {
    const payload = buildPushPayload({
      title: " ", body: " ", url: "https://example.com", tag: "channel-failure",
      category: "operations",
    });
    expect(payload.title).toBe("Goko");
    expect(payload.body).toBe("You have a new update");
    expect(payload.url).toBe("/admin");
    expect(payload.renotify).toBe(false);
  });

  it("limits lock-screen names to a first name", () => {
    expect(notificationFirstName("Ada Lovelace")).toBe("Ada");
    expect(notificationFirstName("")).toBe("Guest");
  });

  it("formats operational details for a small lock screen", () => {
    expect(notificationFoodItems([
      { itemName: "Masala Dosa", quantity: 2 },
      { itemName: "Chai", quantity: 1 },
    ])).toBe("2× Masala Dosa, 1× Chai");
    expect(notificationDate("2026-09-03")).toBe("3 Sept");
    expect(notificationStayDates("2026-09-03", "2026-09-04")).toBe("3 Sept → 4 Sept");
    expect(buildPushPayload({ title: "Order", body: "x".repeat(500) }).body).toHaveLength(500);
  });

  it("notifies for admin-created food orders and retries portable display options", () => {
    const adminOrders = fs.readFileSync(path.join(ROOT, "src/app/api/admin/food-orders/route.ts"), "utf8");
    const worker = fs.readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
    expect(adminOrders).toContain('eventId: `admin-food-order-${order.id}`');
    expect(adminOrders).toContain('title: "New Food Order"');
    expect(worker).toContain("await self.registration.showNotification(title, { body, data: { url } })");
  });
});
