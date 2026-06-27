import { describe, it, expect } from "vitest";
import { parseReservationPayload } from "@/lib/aiosell";

describe("parseReservationPayload", () => {
  it("parses a valid 'book' payload", () => {
    const payload = {
      action: "book",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-123456",
      cmBookingId: "CM-789",
      bookedOn: "2026-06-27",
      checkin: "2026-07-01",
      checkout: "2026-07-03",
      amount: {
        amountAfterTax: 2400,
        amountBeforeTax: 2000,
        tax: 400,
        currency: "INR",
      },
      guest: {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+919876543210",
      },
      rooms: [
        {
          roomCode: "DORM-6",
          rateplanCode: "STD",
          guestName: "John Doe",
          occupancy: { adults: 1, children: 0 },
          prices: [
            { date: "2026-07-01", sellRate: 1200 },
            { date: "2026-07-02", sellRate: 1200 },
          ],
        },
      ],
    };

    const result = parseReservationPayload(payload);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("book");
    expect(result!.bookingId).toBe("BK-123456");
    expect(result!.hotelCode).toBe("GOKO-001");
    expect(result!.guest?.firstName).toBe("John");
    expect(result!.rooms?.length).toBe(1);
  });

  it("parses a valid 'cancel' payload", () => {
    const payload = {
      action: "cancel",
      hotelCode: "GOKO-001",
      channel: "booking.com",
      bookingId: "BK-123456",
    };

    const result = parseReservationPayload(payload);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("cancel");
    expect(result!.bookingId).toBe("BK-123456");
  });

  it("rejects payload with missing action", () => {
    const payload = {
      hotelCode: "GOKO-001",
      bookingId: "BK-123456",
    };

    const result = parseReservationPayload(payload);
    expect(result).toBeNull();
  });

  it("rejects payload with invalid action", () => {
    const payload = {
      action: "refund",
      hotelCode: "GOKO-001",
      bookingId: "BK-123456",
    };

    const result = parseReservationPayload(payload);
    expect(result).toBeNull();
  });

  it("rejects payload with missing bookingId", () => {
    const payload = {
      action: "book",
      hotelCode: "GOKO-001",
    };

    const result = parseReservationPayload(payload);
    expect(result).toBeNull();
  });

  it("rejects payload with missing hotelCode", () => {
    const payload = {
      action: "book",
      bookingId: "BK-123456",
    };

    const result = parseReservationPayload(payload);
    expect(result).toBeNull();
  });

  it("rejects null input", () => {
    expect(parseReservationPayload(null)).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseReservationPayload("string")).toBeNull();
    expect(parseReservationPayload(42)).toBeNull();
    expect(parseReservationPayload(undefined)).toBeNull();
  });
});
