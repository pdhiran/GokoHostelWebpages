import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { actionAllowed, type ActionPerm } from "@/lib/actionPermissions";
import { otaFingerprint, pushIfOtaChanged } from "@/lib/aiosellSync";
import { occupiedNights, exclusiveEndDate, type InventoryPool } from "@/lib/inventoryAvailability";
import {
  assignedBedsMatchNeeds,
  channelBedNeeds,
  channelNeedsAreMapped,
  enrichUnassignedBooking,
  requestedDormsForCodes,
  roomCodesFromChannelBooking,
} from "@/lib/channelAutoAssign";
import { pushNoShow, type AiosellConfig } from "@/lib/aiosell";
import {
  getBookingCalendarData, getBookingDetail, searchBookings, getUnassignedBookings,
  checkBedAvailability, getAvailableBedsForRange, validateBedsForRange, assignBedToBooking, unassignBookingBeds,
  unassignBookingBedsByBedIds,
  cancelBedAssignments, addBookingHistoryEntry, getBookingHistoryEntries,
  addBooking, updateBookingFull, getAllDorms, getAllBeds, getBedById,
  getChannelConfig, getActiveBedBlocks, getSetting,
  getRoomTypeMappings, getRatePlanMappings, getAllDailyRates,
  deactivateBedBlocksByBedIds, shortenAssignedCheckout,
} from "@/db/queries";
import { todayIST } from "@/lib/utils";
import {
  BOOKING_TAX_SETTING,
  bookingDiscountRupees,
  bookingTaxPercent,
  bookingTotals,
  parseGokoWalkin,
  stringifyGokoWalkin,
  walkinDiscountOnGross,
  nextGokoWalkinRaw,
} from "@/lib/bookingPricing";

function bookingDateRange(checkinDate: string, checkoutDate?: string | null): string[] {
  return occupiedNights(checkinDate, checkoutDate);
}

function stayCheckout(checkinDate: string, checkoutDate?: string | null): string | null {
  return exclusiveEndDate(checkinDate, checkoutDate);
}

function stayClosed(status?: string | null): boolean {
  return status === "checked_out" || status === "no_show" || status === "cancelled";
}

function isBookingDotCom(platform?: string | null): boolean {
  return (platform || "").toLowerCase().replace(/[._\s-]/g, "") === "bookingcom";
}

function activeAssignmentDormIds(assignments: { dormId: number; status?: string }[] | undefined): number[] {
  return (assignments ?? [])
    .filter((a) => (a.status ?? "assigned") === "assigned")
    .map((a) => a.dormId);
}

function channelSource(source?: string | null): boolean {
  return source === "channel_manager";
}

function generateGokoBookingId(): string {
  const dateStr = todayIST().replace(/-/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 6; i++) random += chars[Math.floor(Math.random() * chars.length)];
  return `GOKO${dateStr}${random}`;
}

async function loadBookingTaxPercent(): Promise<number> {
  return bookingTaxPercent(await getSetting(BOOKING_TAX_SETTING));
}

function stayAmounts(gross: number, rawData: string | null | undefined, taxPercent: number) {
  const walkin = parseGokoWalkin(rawData);
  const priced = bookingTotals(gross, {
    discount: walkinDiscountOnGross(gross, walkin),
    taxPercent,
  });
  const totalBeforeTax = priced.beforeTax;
  const tax = priced.tax;
  return { totalBeforeTax, tax, total: totalBeforeTax + tax, discount: priced.discount, walkin };
}

function assignmentPool(existing?: string | null): InventoryPool {
  if (existing === "offline" || existing === "block" || existing === "online") return existing;
  return "online";
}

async function reassignSameBeds(
  bookingId: number,
  assignments: Array<{ bedId: number; dormId: number; inventoryPool?: string | null }>,
  checkinDate: string,
  checkoutDate: string,
  actingUser: string,
): Promise<boolean> {
  await unassignBookingBeds(bookingId);
  for (const a of assignments) {
    const ok = await assignBedToBooking({
      bookingId,
      bedId: a.bedId,
      dormId: a.dormId,
      checkinDate,
      checkoutDate,
      assignedBy: actingUser,
      inventoryPool: assignmentPool(a.inventoryPool),
    });
    if (!ok) {
      await unassignBookingBeds(bookingId);
      return false;
    }
  }
  return true;
}

async function pushIfGokoOccupancy(
  source: string | null | undefined,
  before: string,
  dormIds: number[],
  dates: string[],
) {
  if (channelSource(source) || !before) return;
  await pushIfOtaChanged(before, dormIds, dates).catch(() => {});
}

async function assignTaggedBeds(
  bookingId: number,
  bedIds: number[],
  checkinDate: string,
  checkoutDate: string,
  actingUser: string,
): Promise<{ labels: string[]; pools: InventoryPool[]; dormIds: number[] }> {
  const tagged = await getAvailableBedsForRange(checkinDate, checkoutDate);
  const byId = new Map(tagged.map((b) => [b.id, b]));
  const prepared: { bedId: number; dormId: number; dormName: string; bedLabel: string; pool: InventoryPool; tagPool: InventoryPool }[] = [];
  for (const bedId of bedIds) {
    const tag = byId.get(bedId);
    const bed = await getBedById(bedId);
    if (!bed || !tag) return { labels: [], pools: [], dormIds: [] };
    prepared.push({
      bedId,
      dormId: bed.dormId,
      dormName: bed.dormName,
      bedLabel: bed.bedId,
      pool: tag.pool,
      tagPool: tag.pool,
    });
  }
  const labels: string[] = [];
  const pools: InventoryPool[] = [];
  const dormIds: number[] = [];
  const written: number[] = [];
  for (const p of prepared) {
    const ok = await assignBedToBooking({
      bookingId,
      bedId: p.bedId,
      dormId: p.dormId,
      checkinDate,
      checkoutDate,
      assignedBy: actingUser,
      inventoryPool: p.pool,
    });
    if (!ok) {
      await unassignBookingBedsByBedIds(bookingId, written);
      return { labels: [], pools: [], dormIds: [] };
    }
    if (p.tagPool === "block") {
      await deactivateBedBlocksByBedIds([p.bedId], checkinDate, checkoutDate, actingUser);
    }
    written.push(p.bedId);
    labels.push(`${p.dormName}/${p.bedLabel}`);
    pools.push(p.pool);
    dormIds.push(p.dormId);
  }
  return { labels, pools, dormIds };
}

function assignFailed(requested: number[], labels: string[]): string | null {
  if (labels.length === requested.length) return null;
  return labels.length === 0
    ? "No beds could be assigned (conflicts exist)"
    : "Could not assign all selected beds";
}

function diffDays(start: string, end: string): number {
  return occupiedNights(start, end).length;
}

const ACTION_PERMISSIONS: Record<string, ActionPerm> = {
  getCalendarData: "canViewBookings",
  getDetail: "canViewBookings",
  search: "canViewBookings",
  getUnassigned: "canViewBookings",
  checkAvailability: "canViewBookings",
  getAvailableBeds: "canViewBookings",
  getBookingHistory: "canViewBookings",
  createBooking: "canAddBooking",
  assignBeds: "canAddBooking",
  checkIn: ["canCheckIn", "canAddBooking"],
  checkOut: ["canCheckOut", "canAddBooking"],
  modifyCheckin: "canAddBooking",
  modifyCheckout: "canAddBooking",
  editReservation: "canAddBooking",
  moveRoom: "canAddBooking",
  assignGuest: "canAddBooking",
  cancelBooking: "canDeleteBooking",
  markNoShow: "canDeleteBooking",
  hold: "canDeleteBooking",
  unassign: "canDeleteBooking",
  rollbackCheckIn: "admin_only",
  rollbackCheckOut: "admin_only",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action, username } = body;

    const authResult = await authenticateUser(password, username);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, permissions } = authResult;
    const actingUser = username || role;

    const requiredPerm = ACTION_PERMISSIONS[action];
    if (!requiredPerm) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const gate = actionAllowed(role, permissions, requiredPerm);
    if (gate === "admin_required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    if (gate === "forbidden") {
      return NextResponse.json({ error: "You don't have permission to perform this action" }, { status: 403 });
    }

    // --- View Actions ---

    if (action === "getCalendarData") {
      const { startDate, endDate } = body;
      if (!startDate || !endDate) return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });

      const calendarData = await getBookingCalendarData(startDate, endDate);
      const allDorms = await getAllDorms();
      const allBeds = await getAllBeds();
      const activeBlocks = await getActiveBedBlocks(undefined, startDate, endDate);
      const blockedBedIds = new Set(activeBlocks.map((b) => b.bedId));

      const dormsWithBeds = allDorms.map((d) => ({
        id: d.id,
        name: d.name,
        beds: allBeds
          .filter((b) => b.dormId === d.id)
          .map((b) => ({ id: b.id, bedId: b.bedId, dormId: b.dormId, dormName: b.dormName, isBlocked: blockedBedIds.has(b.id) })),
      }));

      const enrichedBookings = calendarData.bookings.map((b) => {
        const checkout = stayCheckout(b.checkinDate, b.checkoutDate);
        const nights = checkout ? diffDays(b.checkinDate, checkout) : 0;
        const balance = (b.amountTotal ?? 0) - (b.amountPaid ?? 0);
        return { ...b, nights, balance };
      });

      const bedById = new Map(allBeds.map((b) => [b.id, b]));
      const enrichedAssignments = calendarData.assignments.map((a) => {
        const bed = bedById.get(a.bedId);
        return {
          ...a,
          dormName: bed?.dormName || "",
          bedLabel: bed?.bedId || "",
        };
      });

      return NextResponse.json({
        bookings: enrichedBookings,
        assignments: enrichedAssignments,
        dorms: dormsWithBeds,
        role,
        permissions,
      });
    }

    if (action === "getDetail") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      return NextResponse.json(detail);
    }

    if (action === "search") {
      const { query } = body;
      if (!query || query.length < 4) return NextResponse.json({ error: "Query must be at least 4 characters" }, { status: 400 });
      const results = await searchBookings(query);
      return NextResponse.json({ bookings: results });
    }

    if (action === "getUnassigned") {
      const results = await getUnassignedBookings();
      const mappings = await getRoomTypeMappings();
      return NextResponse.json({
        bookings: results.map((b) => enrichUnassignedBooking(b, mappings)),
      });
    }

    if (action === "checkAvailability") {
      const { checkinDate, checkoutDate, dormId } = body;
      if (!checkinDate || !checkoutDate) return NextResponse.json({ error: "checkinDate and checkoutDate required" }, { status: 400 });
      const available = await getAvailableBedsForRange(checkinDate, checkoutDate, dormId);
      const allDorms = await getAllDorms();
      const result = allDorms.map((d) => ({
        id: d.id,
        name: d.name,
        beds: available.filter((b) => b.dormId === d.id).map((b) => ({
          id: b.id,
          bedId: b.bedId,
          dormId: b.dormId,
          pool: b.pool,
        })),
      }));
      return NextResponse.json({ dorms: result });
    }

    if (action === "getAvailableBeds") {
      const { checkinDate, checkoutDate, bookingId } = body;
      if (!checkinDate || !checkoutDate) return NextResponse.json({ error: "checkinDate and checkoutDate required" }, { status: 400 });
      const available = await getAvailableBedsForRange(checkinDate, checkoutDate, undefined, bookingId);
      const beds = available.map((b) => ({ id: b.id, bedId: b.bedId, dormId: b.dormId, dormName: b.dormName, pool: b.pool }));
      const dormRates: Record<number, number> = {};
      const mappings = await getRoomTypeMappings();
      const ratePlans = await getRatePlanMappings();
      const dayRates = await getAllDailyRates(checkinDate, checkinDate);
      const ratesByPlan = new Map<number, (typeof dayRates)[number]>();
      for (const row of dayRates) {
        if (!ratesByPlan.has(row.ratePlanId)) ratesByPlan.set(row.ratePlanId, row);
      }
      for (const mapping of mappings) {
        const plans = ratePlans.filter((rp) => rp.roomMappingId === mapping.id && rp.isActive);
        if (plans.length === 0) continue;
        const rate = ratesByPlan.get(plans[0].id);
        if (rate) {
          dormRates[mapping.dormId] = rate.adult1Rate ?? rate.rate;
        }
      }
      const taxRate = await loadBookingTaxPercent();
      return NextResponse.json({ beds, dormRates, taxRate });
    }

    if (action === "getBookingHistory") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
      const history = await getBookingHistoryEntries(bookingId);
      return NextResponse.json({ history });
    }

    // --- Create ---

    if (action === "createBooking") {
      const { guestName, contact, email, checkinDate, checkoutDate, platform, nightlyRate, specialRequests, bedIds, discountPercent, discountAmount, discountReason } = body;
      if (!guestName || !checkinDate || !checkoutDate) {
        return NextResponse.json({ error: "guestName, checkinDate, checkoutDate required" }, { status: 400 });
      }
      if (checkoutDate <= checkinDate) {
        return NextResponse.json({ error: "checkoutDate must be after checkinDate" }, { status: 400 });
      }

      const nights = diffDays(checkinDate, checkoutDate);
      const bedsCount = (bedIds as number[])?.length || 1;
      if (bedIds && Array.isArray(bedIds) && bedIds.length > 0) {
        const selectionError = await validateBedsForRange(bedIds, checkinDate, checkoutDate);
        if (selectionError) return NextResponse.json({ error: selectionError }, { status: 400 });
      }
      const src = platform || "walkin";
      const taxPercent = await loadBookingTaxPercent();
      const gross = (nightlyRate || 0) * nights * bedsCount;
      const discount = src === "walkin"
        ? bookingDiscountRupees(gross, { percent: discountPercent, amount: discountAmount })
        : 0;
      const priced = bookingTotals(gross, { discount, taxPercent });
      const totalBeforeTax = priced.beforeTax;
      const tax = priced.tax;
      const total = totalBeforeTax + tax;
      const reason = typeof discountReason === "string" ? discountReason.trim() : "";

      const newBookingId = await addBooking({
        guestName,
        contact: contact || "",
        email: email || "",
        platform: src,
        checkinDate,
        checkoutDate,
        persons: bedsCount,
        nightlyRate: nightlyRate || 0,
        amountBeforeTax: totalBeforeTax,
        amountTax: tax,
        amountTotal: total,
        specialRequests: specialRequests || "",
        source: "manual",
        status: "received",
        gokoBookingId: generateGokoBookingId(),
        rawData: src === "walkin"
          ? stringifyGokoWalkin({
              discount,
              discountPercent: discount > 0 && Number(discountPercent) > 0 ? Number(discountPercent) : undefined,
              discountAmount: discount > 0 && !(Number(discountPercent) > 0) && Number(discountAmount) > 0 ? Number(discountAmount) : undefined,
              discountReason: discount > 0 ? reason : undefined,
              taxPercent,
            })
          : undefined,
      });

      if (!newBookingId) {
        return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
      }

      if (bedIds && Array.isArray(bedIds) && bedIds.length > 0) {
        const dates = bookingDateRange(checkinDate, checkoutDate);
        const dormIds: number[] = [];
        for (const bedId of bedIds) {
          const bed = await getBedById(bedId);
          if (bed) dormIds.push(bed.dormId);
        }
        const before = await otaFingerprint(dormIds, dates);
        const { labels } = await assignTaggedBeds(newBookingId, bedIds, checkinDate, checkoutDate, actingUser);
        const failed = assignFailed(bedIds, labels);
        if (failed) {
          await unassignBookingBeds(newBookingId);
          await updateBookingFull(newBookingId, {
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            cancelledBy: actingUser,
          });
          return NextResponse.json({ error: failed, bookingId: newBookingId }, { status: 409 });
        }
        await pushIfOtaChanged(before, dormIds, dates).catch(() => {});
      }

      if (newBookingId) {
        await addBookingHistoryEntry({
          bookingId: newBookingId,
          action: "Created",
          details: `Manual booking by ${actingUser}. ${bedsCount} bed(s), ${nights} night(s).${discount > 0 ? ` Discount ₹${discount}${reason ? ` (${reason})` : ""}.` : ""}`,
          performedBy: actingUser,
        });
      }

      return NextResponse.json({ success: true, bookingId: newBookingId });
    }

    // --- Assign Beds ---

    if (action === "assignBeds") {
      const { bookingId, bedIds: rawBedIds } = body;
      const bedIds = Array.isArray(rawBedIds)
        ? rawBedIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];
      if (!bookingId || bedIds.length === 0) {
        return NextResponse.json({ error: "bookingId and bedIds[] required" }, { status: 400 });
      }

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Cannot assign beds on a closed booking" }, { status: 409 });
      }

      const checkinDate = detail.booking.checkinDate;
      const checkoutDate = stayCheckout(checkinDate, detail.booking.checkoutDate);
      if (!checkoutDate) return NextResponse.json({ error: "Invalid booking dates" }, { status: 400 });
      const mappings = (await getRoomTypeMappings()) || [];
      const enriched = enrichUnassignedBooking(detail.booking, mappings);
      const currentAssigned = (detail.assignments || []).filter((a) => a.status === "assigned").length;
      if (enriched.requestedBedCount > 0 && currentAssigned + bedIds.length > enriched.requestedBedCount) {
        return NextResponse.json(
          { error: `This stay already has ${currentAssigned} of ${enriched.requestedBedCount} bed(s) (one per person)` },
          { status: 400 },
        );
      }
      if (currentAssigned === 0 && enriched.requestedBedCount > 0) {
        if (bedIds.length !== enriched.requestedBedCount) {
          return NextResponse.json(
            { error: `Select ${enriched.requestedBedCount} bed(s) (one per person)` },
            { status: 400 },
          );
        }
        const selected = [];
        for (const bedId of bedIds) {
          const bed = await getBedById(bedId);
          if (bed) selected.push(bed);
        }
        const needs = channelBedNeeds({
          roomType: detail.booking.roomType,
          rawData: detail.booking.rawData,
          persons: detail.booking.persons,
        });
        const overflow = enriched.requestedDormIds.length > 0
          && selected.some((bed) => !enriched.requestedDormIds.includes(bed.dormId));
        if (
          !overflow
          && channelNeedsAreMapped(needs, mappings)
          && !assignedBedsMatchNeeds(selected, needs, mappings)
        ) {
          return NextResponse.json(
            { error: `Assign ${enriched.requestedNeedLabels} (one per person in those room types)` },
            { status: 400 },
          );
        }
      }
      const selectionError = await validateBedsForRange(bedIds, checkinDate, checkoutDate, bookingId);
      if (selectionError) return NextResponse.json({ error: selectionError }, { status: 400 });

      const fromChannel = channelSource(detail.booking.source);
      const dates = bookingDateRange(checkinDate, checkoutDate);
      const dormIds: number[] = [];
      for (const bedId of bedIds) {
        const bed = await getBedById(bedId);
        if (bed) dormIds.push(bed.dormId);
      }
      const before = fromChannel ? "" : await otaFingerprint(dormIds, dates);
      const { labels } = await assignTaggedBeds(
        bookingId, bedIds, checkinDate, checkoutDate, actingUser,
      );

      const failed = assignFailed(bedIds, labels);
      if (failed) {
        return NextResponse.json({ error: failed, assigned: labels }, { status: 409 });
      }

      await addBookingHistoryEntry({
        bookingId,
        action: "Beds Assigned",
        details: `Assigned: ${labels.join(", ")}`,
        performedBy: actingUser,
      });

      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true, assigned: labels });
    }

    // --- Check In ---

    if (action === "checkIn") {
      const { bookingId, collectPayment } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Roll back checkout before checking in" }, { status: 409 });
      }

      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        status: "checked_in",
        checkedInAt: now,
        checkedInBy: actingUser,
      };

      if (collectPayment) {
        updateData.amountPaid = detail.booking.amountTotal ?? 0;
        updateData.paymentStatus = "paid";
      }

      await updateBookingFull(bookingId, updateData);
      await addBookingHistoryEntry({
        bookingId,
        action: "Checked In",
        details: collectPayment ? `Payment collected at check-in by ${actingUser}` : `Checked in by ${actingUser}`,
        performedBy: actingUser,
      });

      return NextResponse.json({ success: true });
    }

    // --- Check Out ---

    if (action === "checkOut") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Booking is already closed" }, { status: 409 });
      }

      const now = new Date().toISOString();
      const today = todayIST();
      const oldCheckout = stayCheckout(detail.booking.checkinDate, detail.booking.checkoutDate);
      const dates = oldCheckout ? bookingDateRange(detail.booking.checkinDate, oldCheckout) : [];
      const dormIds = [...activeAssignmentDormIds(detail.assignments)];
      const before = dormIds.length && dates.length ? await otaFingerprint(dormIds, dates) : "";

      const updates: Record<string, string> = {
        status: "checked_out",
        checkedOutAt: now,
        checkedOutBy: actingUser,
      };
      if (oldCheckout && today < oldCheckout) {
        const cut = today <= detail.booking.checkinDate ? detail.booking.checkinDate : today;
        await shortenAssignedCheckout(bookingId, cut);
      }
      await updateBookingFull(bookingId, updates);
      await addBookingHistoryEntry({
        bookingId,
        action: "Checked Out",
        details: `Checked out by ${actingUser}`,
        performedBy: actingUser,
      });
      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);

      return NextResponse.json({ success: true });
    }

    // --- Rollback Check In (admin only) ---

    if (action === "rollbackCheckIn") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      await updateBookingFull(bookingId, {
        status: "received",
        checkedInAt: "",
        checkedInBy: "",
      });
      await addBookingHistoryEntry({
        bookingId,
        action: "Check-in Rolled Back",
        details: `Rolled back by ${actingUser}`,
        performedBy: actingUser,
      });

      return NextResponse.json({ success: true });
    }

    // --- Rollback Check Out (admin only) ---

    if (action === "rollbackCheckOut") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      const restoreCheckout = stayCheckout(detail.booking.checkinDate, detail.booking.checkoutDate);
      const assigned = detail.assignments.filter((a) => a.status === "assigned");
      const dates = restoreCheckout ? bookingDateRange(detail.booking.checkinDate, restoreCheckout) : [];
      const dormIds = [...activeAssignmentDormIds(assigned)];
      const before = dormIds.length && dates.length ? await otaFingerprint(dormIds, dates) : "";

      if (restoreCheckout && assigned.length > 0) {
        for (const a of assigned) {
          const from = a.checkoutDate || detail.booking.checkinDate;
          if (from >= restoreCheckout) continue;
          if (!(await checkBedAvailability(a.bedId, from, restoreCheckout, bookingId))) {
            return NextResponse.json({ error: "Beds no longer available for remaining nights" }, { status: 409 });
          }
        }
        await shortenAssignedCheckout(bookingId, restoreCheckout);
      }

      await updateBookingFull(bookingId, {
        status: "checked_in",
        checkedOutAt: "",
        checkedOutBy: "",
      });
      await addBookingHistoryEntry({
        bookingId,
        action: "Check-out Rolled Back",
        details: `Rolled back by ${actingUser}`,
        performedBy: actingUser,
      });
      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);

      return NextResponse.json({ success: true });
    }

    // --- Hold ---

    if (action === "hold") {
      const { bookingId, holdExpiresAt } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      await updateBookingFull(bookingId, {
        status: "hold",
        holdExpiresAt: holdExpiresAt || "",
      });
      await addBookingHistoryEntry({
        bookingId,
        action: "Put on Hold",
        details: holdExpiresAt ? `Hold expires at ${holdExpiresAt}` : "Indefinite hold",
        performedBy: actingUser,
      });

      return NextResponse.json({ success: true });
    }

    // --- Cancel Booking ---

    if (action === "cancelBooking") {
      const { bookingId, assignmentIds } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      const now = new Date().toISOString();
      const cancelDates = detail ? bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate) : [];
      const dormIds = assignmentIds && Array.isArray(assignmentIds) && assignmentIds.length > 0
        ? (detail?.assignments ?? []).filter((a) => assignmentIds.includes(a.id)).map((a) => a.dormId)
        : activeAssignmentDormIds(detail?.assignments);
      const before = await otaFingerprint(dormIds, cancelDates);

      if (assignmentIds && Array.isArray(assignmentIds) && assignmentIds.length > 0) {
        const ownIds = (detail?.assignments ?? [])
          .filter((a) => assignmentIds.includes(a.id))
          .map((a) => a.id);
        if (ownIds.length === 0) {
          return NextResponse.json({ error: "No matching bed assignments on this booking" }, { status: 400 });
        }
        await cancelBedAssignments(ownIds, bookingId);
        await addBookingHistoryEntry({
          bookingId,
          action: "Partial Cancellation",
          details: `Cancelled ${ownIds.length} bed assignment(s) by ${actingUser}`,
          performedBy: actingUser,
        });
      } else {
        await updateBookingFull(bookingId, {
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: actingUser,
        });
        await unassignBookingBeds(bookingId);
        await addBookingHistoryEntry({
          bookingId,
          action: "Cancelled",
          details: `Full cancellation by ${actingUser}`,
          performedBy: actingUser,
        });
      }

      await pushIfGokoOccupancy(detail?.booking.source, before, dormIds, cancelDates);
      return NextResponse.json({ success: true });
    }

    // --- No Show ---

    if (action === "markNoShow") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

      const dates = bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate);
      let dormIds = activeAssignmentDormIds(detail.assignments);
      if (dormIds.length === 0 && channelSource(detail.booking.source)) {
        const mappings = await getRoomTypeMappings();
        const codes = roomCodesFromChannelBooking(null, detail.booking.roomType, detail.booking.rawData);
        dormIds = requestedDormsForCodes(codes, mappings).dormIds;
      }
      const before = await otaFingerprint(dormIds, dates);

      await updateBookingFull(bookingId, { status: "no_show" });
      await unassignBookingBeds(bookingId);

      if (isBookingDotCom(detail.booking.platform) && detail.booking.cmBookingId) {
        try {
          const config = await getChannelConfig();
          if (config && config.isActive) {
            const aiosellConfig: AiosellConfig = {
              hotelCode: config.hotelCode,
              pmsId: config.pmsId,
              apiBaseUrl: config.apiBaseUrl,
              apiUsername: config.apiUsername,
              apiPassword: config.apiPassword,
            };
            await pushNoShow(aiosellConfig, detail.booking.cmBookingId, "booking_com");
          }
        } catch (e) {
          console.error("pushNoShow failed:", e);
        }
      }

      await addBookingHistoryEntry({
        bookingId,
        action: "Marked No-Show",
        details: `Marked as no-show by ${actingUser}`,
        performedBy: actingUser,
      });

      await pushIfOtaChanged(before, dormIds, bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate)).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // --- Unassign ---

    if (action === "unassign") {
      const { bookingId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      const dates = detail ? bookingDateRange(detail.booking.checkinDate, detail.booking.checkoutDate) : [];
      const dormIds = activeAssignmentDormIds(detail?.assignments);
      const before = await otaFingerprint(dormIds, dates);
      await unassignBookingBeds(bookingId);
      await addBookingHistoryEntry({
        bookingId,
        action: "Beds Unassigned",
        details: `All beds unassigned by ${actingUser}`,
        performedBy: actingUser,
      });

      await pushIfGokoOccupancy(detail?.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true });
    }

    // --- Modify Check-in Date ---

    if (action === "modifyCheckin") {
      const { bookingId, newCheckinDate, confirmed, selectedBedIds } = body;
      if (!bookingId || !newCheckinDate) return NextResponse.json({ error: "bookingId and newCheckinDate required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Roll back checkout before changing dates" }, { status: 409 });
      }

      const oldCheckin = detail.booking.checkinDate;
      const oldCheckout = stayCheckout(oldCheckin, detail.booking.checkoutDate);
      if (!oldCheckout) return NextResponse.json({ error: "Invalid booking dates" }, { status: 400 });
      const currentAssignments = detail.assignments.filter((a) => a.status === "assigned");

      if (newCheckinDate === oldCheckin) return NextResponse.json({ error: "New date same as current" }, { status: 400 });

      const isEarlier = newCheckinDate < oldCheckin;
      const dates = [...bookingDateRange(oldCheckin, oldCheckout), ...bookingDateRange(newCheckinDate, oldCheckout)];
      const dormIds = [...activeAssignmentDormIds(currentAssignments)];
      if (selectedBedIds && Array.isArray(selectedBedIds)) {
        for (const bedId of selectedBedIds) {
          const bed = await getBedById(bedId);
          if (bed) dormIds.push(bed.dormId);
        }
      }
      const before = await otaFingerprint(dormIds, dates);

      if (isEarlier) {
        // CI-1: Early check-in — extend assignments backward
        if (currentAssignments.length === 0) {
          // No assignments — just update dates
          if (!confirmed) {
            const available = await getAvailableBedsForRange(newCheckinDate, oldCheckout, undefined, bookingId);
            return NextResponse.json({ needsSelection: true, availableBeds: available, scenario: "CI-1-no-beds" });
          }
          // Confirmed with selected beds
          if (selectedBedIds && selectedBedIds.length > 0) {
            const { labels } = await assignTaggedBeds(bookingId, selectedBedIds, newCheckinDate, oldCheckout, actingUser);
            const failed = assignFailed(selectedBedIds, labels);
            if (failed) return NextResponse.json({ error: failed }, { status: 409 });
          }
        } else {
          // Check if current beds are available for the extended range
          let allAvailable = true;
          for (const a of currentAssignments) {
            const available = await checkBedAvailability(a.bedId, newCheckinDate, a.checkinDate, bookingId);
            if (!available) { allAvailable = false; break; }
          }

          if (!allAvailable && !confirmed) {
            const available = await getAvailableBedsForRange(newCheckinDate, oldCheckout, undefined, bookingId);
            return NextResponse.json({ needsSelection: true, availableBeds: available, scenario: "CI-1-conflict" });
          }

          if (allAvailable) {
            if (!(await reassignSameBeds(bookingId, currentAssignments, newCheckinDate, oldCheckout, actingUser))) {
              return NextResponse.json({ error: "Could not re-assign beds for the new dates" }, { status: 409 });
            }
          } else if (confirmed && selectedBedIds?.length > 0) {
            await unassignBookingBeds(bookingId);
            const { labels } = await assignTaggedBeds(bookingId, selectedBedIds, newCheckinDate, oldCheckout, actingUser);
            const failed = assignFailed(selectedBedIds, labels);
            if (failed) return NextResponse.json({ error: failed }, { status: 409 });
          } else if (confirmed) {
            return NextResponse.json({ error: "Select at least one bed" }, { status: 400 });
          }
        }
      } else {
        // CI-2/3/4: Late check-in — shorten from the start
        if (newCheckinDate >= oldCheckout) {
          return NextResponse.json({ error: "New check-in date must be before check-out date" }, { status: 400 });
        }

        // Simply shorten: cancel old assignments and re-assign with new start date
        if (currentAssignments.length > 0) {
          if (!(await reassignSameBeds(bookingId, currentAssignments, newCheckinDate, oldCheckout, actingUser))) {
            return NextResponse.json({ error: "Could not re-assign beds for the new dates" }, { status: 409 });
          }
        }
      }

      // Update booking dates and recalculate amounts
      const nights = diffDays(newCheckinDate, oldCheckout);
      const nightlyRate = detail.booking.nightlyRate ?? 0;
      const bedsCount = Math.max(1, selectedBedIds?.length || currentAssignments.length);
      const taxPercent = await loadBookingTaxPercent();
      const { totalBeforeTax, tax, discount } = stayAmounts(
        nightlyRate * nights * bedsCount,
        detail.booking.rawData,
        taxPercent,
      );
      const walkinRaw = nextGokoWalkinRaw(
        detail.booking.rawData,
        detail.booking.source,
        discount,
        taxPercent,
      );

      await updateBookingFull(bookingId, {
        checkinDate: newCheckinDate,
        checkoutDate: oldCheckout,
        amountBeforeTax: totalBeforeTax,
        amountTax: tax,
        amountTotal: totalBeforeTax + tax,
        ...(walkinRaw ? { rawData: walkinRaw } : {}),
      });

      await addBookingHistoryEntry({
        bookingId,
        action: "Check-in Modified",
        details: `${oldCheckin} → ${newCheckinDate} by ${actingUser}`,
        performedBy: actingUser,
      });

      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true });
    }

    // --- Modify Check-out Date ---

    if (action === "modifyCheckout") {
      const { bookingId, newCheckoutDate, confirmed, selectedBedIds } = body;
      if (!bookingId || !newCheckoutDate) return NextResponse.json({ error: "bookingId and newCheckoutDate required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Roll back checkout before changing dates" }, { status: 409 });
      }

      const oldCheckin = detail.booking.checkinDate;
      const oldCheckout = stayCheckout(oldCheckin, detail.booking.checkoutDate);
      if (!oldCheckout) return NextResponse.json({ error: "Invalid booking dates" }, { status: 400 });
      const currentAssignments = detail.assignments.filter((a) => a.status === "assigned");

      if (newCheckoutDate === oldCheckout) return NextResponse.json({ error: "New date same as current" }, { status: 400 });
      if (newCheckoutDate <= oldCheckin) return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });

      const isExtending = newCheckoutDate > oldCheckout;
      const dates = [...bookingDateRange(oldCheckin, oldCheckout), ...bookingDateRange(oldCheckin, newCheckoutDate)];
      const dormIds = [...activeAssignmentDormIds(currentAssignments)];
      if (selectedBedIds && Array.isArray(selectedBedIds)) {
        for (const bedId of selectedBedIds) {
          const bed = await getBedById(bedId);
          if (bed) dormIds.push(bed.dormId);
        }
      }
      const before = await otaFingerprint(dormIds, dates);

      if (isExtending) {
        // CO-1: Extend stay — check if current beds are available
        if (currentAssignments.length > 0) {
          let allAvailable = true;
          for (const a of currentAssignments) {
            const available = await checkBedAvailability(a.bedId, oldCheckout, newCheckoutDate, bookingId);
            if (!available) { allAvailable = false; break; }
          }

          if (!allAvailable && !confirmed) {
            const available = await getAvailableBedsForRange(oldCheckin, newCheckoutDate, undefined, bookingId);
            return NextResponse.json({ needsSelection: true, availableBeds: available, scenario: "CO-1-conflict" });
          }

          if (allAvailable) {
            const stayStart = currentAssignments[0]?.checkinDate || oldCheckin;
            if (!(await reassignSameBeds(bookingId, currentAssignments, stayStart, newCheckoutDate, actingUser))) {
              return NextResponse.json({ error: "Could not re-assign beds for the new dates" }, { status: 409 });
            }
          } else if (confirmed && selectedBedIds?.length > 0) {
            await unassignBookingBeds(bookingId);
            const { labels } = await assignTaggedBeds(bookingId, selectedBedIds, oldCheckin, newCheckoutDate, actingUser);
            const failed = assignFailed(selectedBedIds, labels);
            if (failed) return NextResponse.json({ error: failed }, { status: 409 });
          } else if (confirmed) {
            return NextResponse.json({ error: "Select at least one bed" }, { status: 400 });
          }
        } else if (!confirmed) {
          const available = await getAvailableBedsForRange(oldCheckin, newCheckoutDate, undefined, bookingId);
          return NextResponse.json({ needsSelection: true, availableBeds: available, scenario: "CO-1-no-beds" });
        } else if (confirmed && selectedBedIds?.length > 0) {
          const { labels } = await assignTaggedBeds(bookingId, selectedBedIds, oldCheckin, newCheckoutDate, actingUser);
          const failed = assignFailed(selectedBedIds, labels);
          if (failed) return NextResponse.json({ error: failed }, { status: 409 });
        } else if (confirmed) {
          return NextResponse.json({ error: "Select at least one bed" }, { status: 400 });
        }
      } else {
        // CO-2/3: Shorten stay — just shorten assignments
        if (currentAssignments.length > 0) {
          const stayStart = currentAssignments[0]?.checkinDate || oldCheckin;
          if (!(await reassignSameBeds(bookingId, currentAssignments, stayStart, newCheckoutDate, actingUser))) {
            return NextResponse.json({ error: "Could not re-assign beds for the new dates" }, { status: 409 });
          }
        }
      }

      // Update booking dates and recalculate
      const nights = diffDays(oldCheckin, newCheckoutDate);
      const nightlyRate = detail.booking.nightlyRate ?? 0;
      const bedsCount = Math.max(1, selectedBedIds?.length || currentAssignments.length);
      const taxPercent = await loadBookingTaxPercent();
      const { totalBeforeTax, tax, discount } = stayAmounts(
        nightlyRate * nights * bedsCount,
        detail.booking.rawData,
        taxPercent,
      );
      const walkinRaw = nextGokoWalkinRaw(
        detail.booking.rawData,
        detail.booking.source,
        discount,
        taxPercent,
      );

      await updateBookingFull(bookingId, {
        checkoutDate: newCheckoutDate,
        amountBeforeTax: totalBeforeTax,
        amountTax: tax,
        amountTotal: totalBeforeTax + tax,
        ...(walkinRaw ? { rawData: walkinRaw } : {}),
      });

      await addBookingHistoryEntry({
        bookingId,
        action: "Check-out Modified",
        details: `${oldCheckout} → ${newCheckoutDate} by ${actingUser}`,
        performedBy: actingUser,
      });

      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true });
    }

    // --- Edit Reservation (prices / add-remove beds) ---

    if (action === "editReservation") {
      const { bookingId, nightlyRate, amountBeforeTax, amountTax, amountTotal, amountPaid, addBedIds, removeBedIds, taxMode } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      const bedsChanged = (removeBedIds && removeBedIds.length > 0) || (addBedIds && addBedIds.length > 0);
      if (bedsChanged && stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Cannot change beds on a closed booking" }, { status: 409 });
      }

      const updates: Record<string, any> = {};
      const changes: string[] = [];

      // Price updates
      if (nightlyRate !== undefined) {
        updates.nightlyRate = nightlyRate;
        changes.push(`Nightly rate → ${nightlyRate}`);
      }
      if (taxMode === "inclusive" && amountTotal !== undefined) {
        const taxPercent = await loadBookingTaxPercent();
        const total = amountTotal;
        const beforeTax = Math.round(total / (1 + taxPercent / 100));
        const taxAmt = total - beforeTax;
        updates.amountBeforeTax = beforeTax;
        updates.amountTax = taxAmt;
        updates.amountTotal = total;
        changes.push(`Total (incl. tax) → ${total}`);
        const cleared = nextGokoWalkinRaw(detail.booking.rawData, detail.booking.source, 0, taxPercent, true);
        if (cleared) updates.rawData = cleared;
      } else if (taxMode === "exclusive" && amountBeforeTax !== undefined) {
        const taxPercent = await loadBookingTaxPercent();
        const taxAmt = Math.round((amountBeforeTax * taxPercent) / 100);
        updates.amountBeforeTax = amountBeforeTax;
        updates.amountTax = taxAmt;
        updates.amountTotal = amountBeforeTax + taxAmt;
        changes.push(`Amount before tax → ${amountBeforeTax}`);
        const cleared = nextGokoWalkinRaw(detail.booking.rawData, detail.booking.source, 0, taxPercent, true);
        if (cleared) updates.rawData = cleared;
      } else {
        if (amountBeforeTax !== undefined) updates.amountBeforeTax = amountBeforeTax;
        if (amountTax !== undefined) updates.amountTax = amountTax;
        if (amountTotal !== undefined) updates.amountTotal = amountTotal;
        if (amountBeforeTax !== undefined || amountTax !== undefined || amountTotal !== undefined) {
          const taxPercent = await loadBookingTaxPercent();
          const cleared = nextGokoWalkinRaw(detail.booking.rawData, detail.booking.source, 0, taxPercent, true);
          if (cleared) updates.rawData = cleared;
        }
      }
      if (amountPaid !== undefined) {
        updates.amountPaid = amountPaid;
        changes.push(`Amount paid → ${amountPaid}`);
      }

      const checkinDate = detail.booking.checkinDate;
      const checkoutDate = stayCheckout(checkinDate, detail.booking.checkoutDate);
      if (!checkoutDate) return NextResponse.json({ error: "Invalid booking dates" }, { status: 400 });
      const dates = bookingDateRange(checkinDate, checkoutDate);
      const dormIds = [...activeAssignmentDormIds(detail.assignments)];
      if (addBedIds && Array.isArray(addBedIds)) {
        for (const bedId of addBedIds) {
          const bed = await getBedById(bedId);
          if (bed) dormIds.push(bed.dormId);
        }
      }
      const before = bedsChanged ? await otaFingerprint(dormIds, dates) : "";

      // Add beds first so a conflict cannot drop the existing assignment.
      if (addBedIds && Array.isArray(addBedIds) && addBedIds.length > 0) {
        const { labels } = await assignTaggedBeds(bookingId, addBedIds, checkinDate, checkoutDate, actingUser);
        const failed = assignFailed(addBedIds, labels);
        if (failed) {
          return NextResponse.json({ error: failed }, { status: 409 });
        }
        for (const label of labels) changes.push(`Added bed ${label}`);
      }

      if (removeBedIds && Array.isArray(removeBedIds) && removeBedIds.length > 0) {
        const assigned = detail.assignments.filter((a) => a.status === "assigned");
        const assignmentIds = [...new Set(removeBedIds.flatMap((id: number) => {
          if (assigned.some((a) => a.id === id)) return [id];
          return assigned.filter((a) => a.bedId === id).map((a) => a.id);
        }))];
        if (assignmentIds.length > 0) await cancelBedAssignments(assignmentIds, bookingId);
        changes.push(`Removed ${removeBedIds.length} bed(s)`);
      }

      if (Object.keys(updates).length > 0) {
        await updateBookingFull(bookingId, updates);
      }

      if (changes.length > 0) {
        await addBookingHistoryEntry({
          bookingId,
          action: "Reservation Edited",
          details: changes.join("; "),
          performedBy: actingUser,
        });
      }

      if (bedsChanged) await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true });
    }

    // --- Move Room ---

    if (action === "moveRoom") {
      const { bookingId, oldAssignmentId, newBedId } = body;
      if (!bookingId || !newBedId) return NextResponse.json({ error: "bookingId and newBedId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      if (stayClosed(detail.booking.status)) {
        return NextResponse.json({ error: "Cannot move rooms on a closed booking" }, { status: 409 });
      }

      const checkinDate = detail.booking.checkinDate;
      const checkoutDate = stayCheckout(checkinDate, detail.booking.checkoutDate);
      if (!checkoutDate) return NextResponse.json({ error: "Invalid booking dates" }, { status: 400 });
      const dates = bookingDateRange(checkinDate, checkoutDate);
      const newBed = await getBedById(newBedId);
      if (!newBed) return NextResponse.json({ error: "Bed not found" }, { status: 404 });

      const dormIds = [
        ...activeAssignmentDormIds(detail.assignments),
        newBed.dormId,
      ];
      const before = await otaFingerprint(dormIds, dates);

      if (oldAssignmentId) {
        const own = detail.assignments.find((a) => a.id === oldAssignmentId && a.status === "assigned");
        if (!own) return NextResponse.json({ error: "Assignment not found on this booking" }, { status: 400 });
      }

      const { labels } = await assignTaggedBeds(bookingId, [newBedId], checkinDate, checkoutDate, actingUser);
      const failed = assignFailed([newBedId], labels);
      if (failed) {
        return NextResponse.json({ error: failed === "No beds could be assigned (conflicts exist)" ? "Cannot assign bed — conflict exists" : failed }, { status: 409 });
      }

      if (oldAssignmentId) {
        await cancelBedAssignments([oldAssignmentId], bookingId);
      }

      await addBookingHistoryEntry({
        bookingId,
        action: "Room Moved",
        details: `Moved to ${newBed.dormName}/${newBed.bedId} by ${actingUser}`,
        performedBy: actingUser,
      });

      await pushIfGokoOccupancy(detail.booking.source, before, dormIds, dates);
      return NextResponse.json({ success: true });
    }

    // --- Assign Guest (link checkin record) ---

    if (action === "assignGuest") {
      const { bookingId, checkinId } = body;
      if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

      const detail = await getBookingDetail(bookingId);
      if (!detail) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      const existingCmId = detail.booking.cmBookingId || "";
      if (existingCmId && !/^\d+$/.test(existingCmId)) {
        await addBookingHistoryEntry({
          bookingId,
          action: "Guest Linked",
          details: checkinId
            ? `Check-in #${checkinId} noted; channel id ${existingCmId} kept`
            : `Channel id ${existingCmId} kept`,
          performedBy: actingUser,
        });
        return NextResponse.json({ success: true });
      }

      await updateBookingFull(bookingId, { cmBookingId: checkinId ? String(checkinId) : "" });
      await addBookingHistoryEntry({
        bookingId,
        action: "Guest Linked",
        details: checkinId ? `Linked to checkin #${checkinId}` : "Guest link removed",
        performedBy: actingUser,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error("Booking API error:", e);
    const msg = e?.message?.includes("D1") ? "Database error. Please try again." : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
