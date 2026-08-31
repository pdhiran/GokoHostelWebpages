import { describe, expect, it } from "vitest";
import {
  checkinIdsMatchingContact,
  contactToCheckinIdMap,
  foodTabUncheckedMessage,
  unpaidFoodCheckoutMessage,
} from "@/lib/foodTab";
import { readFileSync } from "node:fs";

describe("pending food tab matching", () => {
  const checkins = [
    { id: 1, contact: "+91 98765 43210" },
    { id: 2, contact: "1111111111" },
    { id: 3, contact: "9876543210" },
  ];

  it("normalizes +91 vs 10-digit bed/booking phones onto the same checkin", () => {
    const map = contactToCheckinIdMap(checkins);
    expect(map.get("9876543210")).toBe(3);
    expect(checkinIdsMatchingContact(checkins, "+919876543210")).toEqual([1, 3]);
    expect(checkinIdsMatchingContact(checkins, "98 7654 3210")).toEqual([1, 3]);
  });

  it("does not match a different number", () => {
    expect(checkinIdsMatchingContact(checkins, "9999999999")).toEqual([]);
    expect(contactToCheckinIdMap(checkins).get("9999999999")).toBeUndefined();
  });

  it("checkout copy names the rupee tab and order count", () => {
    expect(unpaidFoodCheckoutMessage("Ada", 45000, 2)).toBe(
      "Ada has an unpaid food tab of ₹450 (2 unpaid orders). Check out anyway?",
    );
    expect(unpaidFoodCheckoutMessage("Ada", 10000, 1)).toBe(
      "Ada has an unpaid food tab of ₹100 (1 unpaid order). Check out anyway?",
    );
    expect(foodTabUncheckedMessage("no-phone")).toBe(
      "No phone on this guest, so the food tab could not be checked. Check out anyway?",
    );
    expect(foodTabUncheckedMessage("lookup-failed")).toBe(
      "Could not check the food tab. Check out anyway?",
    );
  });
});

describe("checkout UIs look up the self-checkin food tab", () => {
  it("booking Check Out Guest fetches getPendingFoodTab before confirm", () => {
    const panel = readFileSync("src/components/admin/booking-dashboard/BookingDetailPanel.tsx", "utf8");
    expect(panel).toContain("promptCheckOut");
    expect(panel).toContain('action: "getPendingFoodTab"');
    expect(panel).toContain("unpaidFoodCheckoutMessage");
    expect(panel).toContain("Check out anyway");
  });

  it("beds and timeline checkout warn on unpaid tab", () => {
    const beds = readFileSync("src/components/admin/AdminBeds.tsx", "utf8");
    expect(beds).toContain("getPendingFoodTab");
    expect(beds).toContain("unpaidFoodCheckoutMessage");
    expect(beds).toContain("Checkout anyway");
    const timeline = readFileSync("src/components/admin/AdminTimeline.tsx", "utf8");
    expect(timeline).toContain("getPendingFoodTab");
    expect(timeline).toContain("unpaidFoodCheckoutMessage");
  });

  it("dashboard today-checkout matching uses all active checkins", () => {
    const route = readFileSync("src/app/api/admin/checkins/route.ts", "utf8");
    expect(route).toContain("checkinIdsMatchingContact");
    expect(route).toContain("getActiveCheckins");
    expect(route).toContain("getPendingFoodTab");
    expect(route).toContain("activeCheckinIdsForContact");
  });

  it("dashboard today-checkout live-looks-up the tab on click", () => {
    const dash = readFileSync("src/components/admin/AdminDashboard.tsx", "utf8");
    expect(dash).toContain('action: "getPendingFoodTab"');
    expect(dash).toContain("foodTabUncheckedMessage");
    expect(dash).toContain("checkoutModal.orderIds");
  });

  it("bookings route exposes getPendingFoodTab next to checkOut", () => {
    const route = readFileSync("src/app/api/admin/bookings/route.ts", "utf8");
    expect(route).toContain("getPendingFoodTab: [\"canCheckOut\", \"canAddBooking\"]");
    expect(route).toContain("action === \"getPendingFoodTab\"");
  });
});
