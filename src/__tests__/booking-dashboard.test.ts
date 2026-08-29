import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { isWeekend } from "@/components/admin/booking-dashboard/utils";

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

    expect(section).toContain("isEarlier = newCheckinDate < oldCheckin");
    expect(section).toContain("Late check-in");
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

      expect(section).toContain("pushIfOtaChanged(before, dormIds, cancelDates)");
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

    expect(section).toContain("pushIfOtaChanged(before, dormIds, bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate))");
  });
});

describe("Booking Dashboard: moveRoom assigns the new bed before releasing the old one", () => {
  const routeCode = readFile("src/app/api/admin/bookings/route.ts");

  it("keeps the guest on the old bed if the new bed cannot be assigned", () => {
    const section = routeCode.match(/action === "moveRoom"[\s\S]*?action === "assignGuest"/)![0];
    const assignAt = section.indexOf("assignTaggedBeds(bookingId, [newBedId]");
    const cancelAt = section.indexOf("cancelBedAssignments([oldAssignmentId])");
    expect(assignAt).toBeGreaterThan(0);
    expect(cancelAt).toBeGreaterThan(assignAt);
  });
});

describe("Booking Calendar: inclusive last night", () => {
  const queriesCode = readFile("src/db/queries.ts");

  function occupiesInclusiveRange(checkin: string, checkout: string, start: string, end: string) {
    return checkin <= end && checkout > start;
  }

  it("treats the calendar end date as the last visible night, not an exclusive checkout", () => {
    const fn = queriesCode.match(/export async function getBookingCalendarData[\s\S]*?return \{ bookings/ )![0];
    expect(fn).toContain("checkinDate} <= ${endDate}");
    expect(fn).toContain("checkoutDate} > ${startDate}");
    expect(fn).not.toMatch(/checkinDate\} < \$\{endDate\}/);
  });

  it("includes a 6 Sep stay on the default 10-day view that ends 6 Sep", () => {
    // 29 Aug → range Aug 28 .. Sep 6 (yesterday through yesterday+9)
    expect(occupiesInclusiveRange("2026-09-06", "2026-09-07", "2026-08-28", "2026-09-06")).toBe(true);
    expect("2026-09-06" < "2026-09-06").toBe(false);
  });
});

describe("Booking Calendar: sticky dates and row colour", () => {
  const grid = readFile("src/components/admin/booking-dashboard/BookingCalendarGrid.tsx");
  const dashboard = readFile("src/components/admin/booking-dashboard/index.tsx");
  const adminPage = readFile("src/app/admin/page.tsx");
  const utils = readFile("src/components/admin/booking-dashboard/utils.ts");

  it("scrolls inside overflow-auto so sticky top is not cancelled by overflow-x-auto alone", () => {
    const open = grid.indexOf("return (");
    const slice = grid.slice(open, open + 400);
    expect(slice).toMatch(/overflow-auto/);
    expect(slice).not.toMatch(/className="overflow-x-auto/);
    expect(grid).toMatch(/sticky top-0 z-20/);
    expect(grid).toMatch(/sticky top-0 left-0 z-30/);
    expect(grid).toMatch(/sticky left-0 z-20/);
  });

  it("fills leftover viewport and skips y-transform on the bookings tab", () => {
    expect(dashboard).toMatch(/flex h-full min-h-0 flex-1 flex-col gap-4/);
    expect(adminPage).toMatch(/fillViewport = section === "inventory" \|\| section === "bookings"/);
    expect(adminPage).toMatch(/fillViewport && "flex h-full min-h-0 flex-1 flex-col"/);
    expect(adminPage).not.toMatch(/framer-motion/);
  });

  it("tints weekends, today, dorm groups, and blocked beds", () => {
    expect(utils).toContain("export function isWeekend");
    expect(utils).toContain("getUTCDay()");
    expect(grid).toContain("isWeekend(date)");
    expect(grid).toContain("bg-emerald-50");
    expect(grid).toContain("bg-sky-50");
    expect(grid).toContain("bg-brand-sand");
    expect(grid).toContain("bg-amber-50/90");
    expect(grid).toContain("bg-gray-100");
    expect(isWeekend("2026-08-29")).toBe(true);
    expect(isWeekend("2026-08-30")).toBe(true);
    expect(isWeekend("2026-08-31")).toBe(false);
  });
});

describe("Booking API: calendar enrich and rates batch", () => {
  const route = readFile("src/app/api/admin/bookings/route.ts");

  it("maps beds by id instead of find-per-assignment", () => {
    const section = route.match(/action === "getCalendarData"[\s\S]*?action === "getDetail"/)![0];
    expect(section).toContain("new Map(allBeds.map");
    expect(section).toContain("bedById.get(a.bedId)");
    expect(section).not.toContain("allBeds.find");
  });

  it("loads check-in-day rates once via getAllDailyRates", () => {
    const section = route.match(/action === "getAvailableBeds"[\s\S]*?action === "getBookingHistory"/)![0];
    expect(section).toContain("getAllDailyRates(checkinDate, checkinDate)");
    expect(section).not.toMatch(/await getDailyRates\(/);
    expect(section).toContain("adult1Rate ?? rate.rate");
    expect(section).toContain("pool: b.pool");
    expect(section).toMatch(/if \(rate\) \{\s*dormRates\[mapping\.dormId\] = rate\.adult1Rate \?\? rate\.rate;/);
  });
});
