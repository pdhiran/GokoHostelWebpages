import { describe, expect, it } from "vitest";
import {
  bookingWhatsAppNumber,
  bookingWhatsAppReference,
  fillBookingWhatsAppTemplate,
  parseBookingWhatsAppTemplates,
  validateBookingWhatsAppTemplates,
} from "@/lib/bookingWhatsApp";

describe("booking WhatsApp templates", () => {
  it("normalizes Indian local and explicit international numbers", () => {
    expect(bookingWhatsAppNumber("98336 24363")).toBe("919833624363");
    expect(bookingWhatsAppNumber("+44 7700 900123")).toBe("447700900123");
    expect(bookingWhatsAppNumber("123")).toBe("");
  });

  it("uses the guest-facing platform and reference instead of internal IDs", () => {
    expect(bookingWhatsAppReference({ platform: "Booking.com", bookingRef: "1234567890", gokoBookingId: "GOKO-LOCAL" })).toBe("Booking.com: 1234567890");
    expect(bookingWhatsAppReference({ platform: "hostelworld", bookingRef: "HW-12345" })).toBe("Hostelworld: HW-12345");
    expect(bookingWhatsAppReference({ platform: "booking_engine", gokoBookingId: "GOKO20260906ABC123" })).toBe("Goko Hostel: GOKO20260906ABC123");
    expect(bookingWhatsAppReference({ platform: "walkin" })).toBe("Goko Hostel booking");
  });

  it("replaces every supported placeholder, including repeated ones", () => {
    const result = fillBookingWhatsAppTemplate("Hi {GUEST_NAME}, {BOOKING_ID}. Hi {GUEST_NAME}!", {
      "{GUEST_NAME}": "Sunny",
      "{CHECK_IN}": "6 Sep",
      "{CHECK_OUT}": "7 Sep",
      "{BOOKING_ID}": "Booking.com: 1234567890",
      "{BALANCE}": "₹560",
      "{PROPERTY_NAME}": "Goko Hostel",
    });
    expect(result).toBe("Hi Sunny, Booking.com: 1234567890. Hi Sunny!");
  });

  it("validates the limit and safely parses stored JSON", () => {
    const valid = [{ id: "one", name: "Welcome", message: "Hi {GUEST_NAME}" }];
    expect(validateBookingWhatsAppTemplates(valid)).toEqual(valid);
    expect(validateBookingWhatsAppTemplates(Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: "x", message: "x" })))).toBeNull();
    expect(parseBookingWhatsAppTemplates("not json")).toEqual([]);
  });
});
