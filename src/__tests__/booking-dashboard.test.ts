import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

describe("Booking Dashboard: Query Logic Verification", () => {
  describe("checkBedAvailability", () => {
    const queriesCode = readFile("src/db/queries.ts");

    it("has correct overlap condition: checkin_date < checkoutDate AND checkout_date > checkinDate", () => {
      const fnMatch = queriesCode.match(
        /export async function checkBedAvailability[\s\S]*?return \(conflicts\[0\]/
      );
      expect(fnMatch).not.toBeNull();
      const fn = fnMatch![0];

      expect(fn).toContain("checkinDate} < ${checkoutDate}");
      expect(fn).toContain("checkoutDate} > ${checkinDate}");
    });

    it("filters only 'assigned' status", () => {
      const fnMatch = queriesCode.match(
        /export async function checkBedAvailability[\s\S]*?return \(conflicts\[0\]/
      );
      const fn = fnMatch![0];
      expect(fn).toContain('eq(bookingBedAssignments.status, "assigned")');
    });

    it("supports excludeBookingId to ignore current booking's own assignments", () => {
      const fnMatch = queriesCode.match(
        /export async function checkBedAvailability[\s\S]*?return \(conflicts\[0\]/
      );
      const fn = fnMatch![0];
      expect(fn).toContain("excludeBookingId");
      expect(fn).toContain("bookingId} != ${excludeBookingId}");
    });

    it("returns true (available) when conflict count is 0", () => {
      const fnMatch = queriesCode.match(
        /export async function checkBedAvailability[\s\S]*?return \(conflicts\[0\][\s\S]*?\n\}/
      );
      expect(fnMatch).not.toBeNull();
      const fn = fnMatch![0];
      expect(fn).toContain("=== 0");
    });
  });

  describe("assignBedToBooking", () => {
    const queriesCode = readFile("src/db/queries.ts");

    it("uses INSERT ... WHERE NOT EXISTS pattern for atomic conflict check", () => {
      const fnMatch = queriesCode.match(
        /export async function assignBedToBooking[\s\S]*?return \(result/
      );
      expect(fnMatch).not.toBeNull();
      const fn = fnMatch![0];

      expect(fn).toContain("INSERT INTO booking_bed_assignments");
      expect(fn).toContain("WHERE NOT EXISTS");
      expect(fn).toContain("SELECT 1 FROM booking_bed_assignments");
    });

    it("conflict check uses same overlap logic (checkin_date < checkoutDate AND checkout_date > checkinDate)", () => {
      const fnMatch = queriesCode.match(
        /export async function assignBedToBooking[\s\S]*?return \(result/
      );
      const fn = fnMatch![0];
      expect(fn).toContain("checkin_date < ${data.checkoutDate}");
      expect(fn).toContain("checkout_date > ${data.checkinDate}");
    });

    it("returns false (not assigned) when no rows written", () => {
      const fnMatch = queriesCode.match(
        /export async function assignBedToBooking[\s\S]*?return \(result[\s\S]*?\n\}/
      );
      expect(fnMatch).not.toBeNull();
      const fn = fnMatch![0];
      expect(fn).toContain("rowsWritten");
      expect(fn).toContain("> 0");
    });

    it("only blocks against 'assigned' status conflicts", () => {
      const fnMatch = queriesCode.match(
        /export async function assignBedToBooking[\s\S]*?return \(result/
      );
      const fn = fnMatch![0];
      expect(fn).toContain("status = 'assigned'");
    });
  });
});

describe("Booking Dashboard: modifyCheckin Scenarios", () => {
  const routeCode = readFile("src/app/api/admin/bookings/route.ts");

  it("handles CI-1: late check-in (new > old, new < checkout) — updates assignments to shorter range", () => {
    const modifySection = routeCode.match(
      /action === "modifyCheckin"[\s\S]*?action === "modifyCheckout"/
    );
    expect(modifySection).not.toBeNull();
    const section = modifySection![0];

    expect(section).toContain("isLater = newCheckinDate > oldCheckin");
    expect(section).toContain("await unassignBookingBeds(bookingId)");
    expect(section).toContain("checkinDate: newCheckinDate, checkoutDate: a.checkoutDate");
  });

  it("handles CI-2: late check-in where new >= checkout — returns 400 error", () => {
    const modifySection = routeCode.match(
      /action === "modifyCheckin"[\s\S]*?action === "modifyCheckout"/
    );
    const section = modifySection![0];

    expect(section).toContain("newCheckinDate >= oldCheckout");
    expect(section).toContain("New check-in date must be before check-out date");
    expect(section).toContain("status: 400");
  });

  it("handles CI-3: early check-in (new < old), same bed available — extends with payment recalc", () => {
    const modifySection = routeCode.match(
      /action === "modifyCheckin"[\s\S]*?action === "modifyCheckout"/
    );
    const section = modifySection![0];

    expect(section).toContain("isEarlier = newCheckinDate < oldCheckin");
    expect(section).toContain("checkBedAvailability(a.bedId, newCheckinDate");
    expect(section).toContain("allAvailable");
    expect(section).toContain("nightlyRate * nights * bedsCount");
    expect(section).toContain("totalBeforeTax * 0.12");
  });

  it("handles CI-4: early check-in, same bed NOT available — returns needsSelection with available beds", () => {
    const modifySection = routeCode.match(
      /action === "modifyCheckin"[\s\S]*?action === "modifyCheckout"/
    );
    const section = modifySection![0];

    expect(section).toContain("!allAvailable && !confirmed");
    expect(section).toContain("needsSelection: true");
    expect(section).toContain("availableBeds");
    expect(section).toContain("getAvailableBedsForRange(newCheckinDate");
  });

  it("always recalculates amountBeforeTax, amountTax, amountTotal on date change", () => {
    const modifySection = routeCode.match(
      /action === "modifyCheckin"[\s\S]*?action === "modifyCheckout"/
    );
    const section = modifySection![0];

    expect(section).toContain("updateBookingFull(bookingId, {");
    expect(section).toContain("amountBeforeTax: totalBeforeTax");
    expect(section).toContain("amountTax: tax");
    expect(section).toContain("amountTotal: totalBeforeTax + tax");
  });
});

describe("Booking Dashboard: cancelBooking Logic", () => {
  const routeCode = readFile("src/app/api/admin/bookings/route.ts");

  describe("Full cancellation (no assignmentIds)", () => {
    it("sets status to 'cancelled'", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      expect(cancelSection).not.toBeNull();
      const section = cancelSection![0];

      expect(section).toContain('status: "cancelled"');
    });

    it("sets cancelledAt and cancelledBy", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      expect(section).toContain("cancelledAt: now");
      expect(section).toContain("cancelledBy: actingUser");
    });

    it("unassigns all bed assignments via unassignBookingBeds", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      expect(section).toContain("unassignBookingBeds(bookingId)");
    });

    it("triggers inventory push", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      expect(section).toContain("triggerInventoryPush(cancelDates)");
    });
  });

  describe("Partial cancellation (with assignmentIds)", () => {
    it("uses cancelBedAssignments with specific IDs", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      expect(section).toContain("cancelBedAssignments(assignmentIds)");
    });

    it("does NOT set booking status to cancelled", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      const partialBlock = section.match(
        /assignmentIds && Array\.isArray[\s\S]*?} else/
      );
      expect(partialBlock).not.toBeNull();
      expect(partialBlock![0]).not.toContain('status: "cancelled"');
    });

    it("logs partial cancellation in history", () => {
      const cancelSection = routeCode.match(
        /action === "cancelBooking"[\s\S]*?action === "markNoShow"/
      );
      const section = cancelSection![0];

      expect(section).toContain("Partial Cancellation");
      expect(section).toContain("assignmentIds.length");
    });
  });
});

describe("Booking Dashboard: markNoShow Logic", () => {
  const routeCode = readFile("src/app/api/admin/bookings/route.ts");

  it("sets status to 'no_show'", () => {
    const noShowSection = routeCode.match(
      /action === "markNoShow"[\s\S]*?action === "unassign"/
    );
    expect(noShowSection).not.toBeNull();
    const section = noShowSection![0];

    expect(section).toContain('status: "no_show"');
  });

  it("calls pushNoShow ONLY for booking_com platform with cmBookingId", () => {
    const noShowSection = routeCode.match(
      /action === "markNoShow"[\s\S]*?action === "unassign"/
    );
    const section = noShowSection![0];

    expect(section).toContain('platform === "booking_com"');
    expect(section).toContain("cmBookingId");
    expect(section).toContain("pushNoShow(aiosellConfig");
  });

  it("triggers inventory push", () => {
    const noShowSection = routeCode.match(
      /action === "markNoShow"[\s\S]*?action === "unassign"/
    );
    const section = noShowSection![0];

    expect(section).toContain("triggerInventoryPush(bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate))");
  });
});
