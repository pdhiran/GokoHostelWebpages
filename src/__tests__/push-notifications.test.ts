import { describe, expect, it } from "vitest";
import { buildPushPayload, notificationFirstName } from "@/lib/pushNotify";

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
});
