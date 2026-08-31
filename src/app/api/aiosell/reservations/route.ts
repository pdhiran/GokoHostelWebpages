import { NextRequest, NextResponse } from "next/server";
import { getChannelConfig, addBooking, updateBookingFull, getBookingByRef, unassignBookingBeds, addBookingHistoryEntry, getBookingDetail, checkBedAvailability, assignBedToBooking } from "@/db/queries";
import { triggerInventoryPush } from "@/lib/aiosellSync";
import { parseReservationPayload, type ReservationPayload } from "@/lib/aiosell";
import { occupiedNights, exclusiveEndDate } from "@/lib/inventoryAvailability";
import { logPmsCall } from "@/lib/pmsLog";

const WEBHOOK_URL = "/api/aiosell/reservations";

type HandlerResult = { success: boolean; message: string };

function respondSuccess(message: string): HandlerResult {
  return { success: true, message };
}

function respondError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: unknown;

  const logPull = (opts: {
    status: "success" | "failed";
    httpStatus: number;
    errorMessage?: string;
    response?: unknown;
    /** Only pass after webhook auth succeeds — unauthenticated POSTs must not store bodies. */
    request?: unknown;
  }) =>
    logPmsCall({
      direction: "pull",
      type: "reservation",
      status: opts.status,
      request: opts.request,
      response: opts.response,
      errorMessage: opts.errorMessage,
      recordsAffected: opts.status === "success" ? 1 : 0,
      httpMethod: "POST",
      url: WEBHOOK_URL,
      httpStatus: opts.httpStatus,
      durationMs: Date.now() - started,
    }).catch(() => {});

  try {
    body = await req.json();
  } catch {
    await logPull({ status: "failed", httpStatus: 400, errorMessage: "Invalid JSON body" });
    return respondError("Invalid JSON body");
  }

  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      await logPull({ status: "failed", httpStatus: 503, errorMessage: "Channel manager not active", response: { success: false, message: "Channel manager not active" } });
      return respondError("Channel manager not active", 503);
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
    if (!config.webhookSecret) {
      await logPull({ status: "failed", httpStatus: 503, errorMessage: "Webhook not configured", response: { success: false, message: "Webhook not configured" } });
      return respondError("Webhook not configured", 503);
    }
    let authValid = authHeader === config.webhookSecret || authHeader === `Bearer ${config.webhookSecret}`;
    if (!authValid && authHeader.startsWith("Basic ")) {
      try {
        const decoded = atob(authHeader.slice(6));
        authValid = decoded === config.webhookSecret || decoded.split(":").slice(1).join(":") === config.webhookSecret;
      } catch {}
    }
    if (!authValid) {
      await logPull({ status: "failed", httpStatus: 401, errorMessage: "Unauthorized", response: { success: false, message: "Unauthorized" } });
      return respondError("Unauthorized", 401);
    }

    const payload = parseReservationPayload(body);
    if (!payload) {
      await logPull({ status: "failed", httpStatus: 400, errorMessage: "Invalid reservation payload", response: { success: false, message: "Invalid reservation payload: missing action, hotelCode, or bookingId" }, request: body });
      return respondError("Invalid reservation payload: missing action, hotelCode, or bookingId");
    }

    if (payload.hotelCode !== config.hotelCode) {
      await logPull({ status: "failed", httpStatus: 400, errorMessage: "Invalid hotel code", response: { success: false, message: "Invalid hotel code" }, request: body });
      return respondError("Invalid hotel code");
    }

    try {
      let result: HandlerResult;
      switch (payload.action) {
        case "book":
          result = await handleNewBooking(payload);
          break;
        case "modify":
          result = await handleModifyBooking(payload);
          break;
        case "cancel":
          result = await handleCancelBooking(payload);
          break;
        default:
          await logPull({ status: "failed", httpStatus: 400, errorMessage: `Unknown action: ${payload.action}`, response: { success: false, message: `Unknown action: ${payload.action}` }, request: body });
          return respondError(`Unknown action: ${payload.action}`);
      }

      await logPull({ status: "success", httpStatus: 200, response: result, request: body });
      return NextResponse.json(result);
    } catch (processingError: any) {
      const message = processingError?.message || "Processing failed";
      console.error("Reservation webhook error:", message);
      await logPull({ status: "failed", httpStatus: 500, errorMessage: message, response: { success: false, message: "Internal error processing reservation" }, request: body });
      return respondError("Internal error processing reservation", 500);
    }
  } catch (error: any) {
    const message = error?.message || "Unknown";
    console.error("Reservation webhook error:", message);
    await logPull({ status: "failed", httpStatus: 500, errorMessage: message, response: { success: false, message: "Internal error processing reservation" } });
    return respondError("Internal error processing reservation", 500);
  }
}

function extractBookingFields(payload: ReservationPayload) {
  const guest = payload.guest;
  const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : "Unknown Guest";
  const contact = guest?.phone || guest?.email || "";
  const roomInfo = payload.rooms?.map((r) => r.roomCode).join(", ") || "";
  const persons = payload.rooms?.reduce((sum, r) => sum + (r.occupancy?.adults ?? 0) + (r.occupancy?.children ?? 0), 0) || 1;
  const ratePlan = payload.rooms?.[0]?.rateplanCode || "";
  const nightlyRate = payload.rooms?.[0]?.prices?.[0]?.sellRate || 0;

  return {
    guestName,
    contact,
    platform: payload.channel || "aiosell",
    bookingRef: payload.bookingId,
    checkinDate: payload.checkin || "",
    checkoutDate: payload.checkout || "",
    roomType: roomInfo,
    persons,
    paymentStatus: payload.pah ? "pay_at_hotel" : "prepaid",
    specialRequests: payload.specialRequests || "",
    status: "received" as const,
    source: "channel_manager" as const,
    rawData: JSON.stringify(payload),
    amountBeforeTax: payload.amount?.amountBeforeTax || 0,
    amountTax: payload.amount?.tax || 0,
    amountTotal: payload.amount?.amountAfterTax || 0,
    currency: payload.amount?.currency || "INR",
    email: guest?.email || "",
    cmBookingId: payload.cmBookingId || "",
    ratePlan,
    nightlyRate,
  };
}

async function handleNewBooking(payload: ReservationPayload) {
  const existing = await getBookingByRef(payload.bookingId);
  if (existing) {
    if (existing.status === "cancelled" || existing.status === "no_show") {
      await updateBookingFull(existing.id, {
        ...extractBookingFields(payload),
        status: "received",
        cancelledAt: "",
        cancelledBy: "",
      });
      await addBookingHistoryEntry({
        bookingId: existing.id,
        action: "Rebooked from Channel",
        details: `Cancelled/no-show ref reused via ${payload.channel || "aiosell"}`,
        performedBy: "channel_manager",
      });
      return respondSuccess("Reservation Created Successfully");
    }
    return respondSuccess("Reservation already exists (duplicate)");
  }

  const result = await addBooking(extractBookingFields(payload));
  const bookingId = (result as any)?.meta?.last_row_id || (result as any)?.lastInsertRowid;

  if (bookingId) {
    await addBookingHistoryEntry({
      bookingId,
      action: "Received from Channel",
      details: `New booking via ${payload.channel || "aiosell"} (ref: ${payload.bookingId})`,
      performedBy: "channel_manager",
    });
  }

  return respondSuccess("Reservation Created Successfully");
}

async function handleModifyBooking(payload: ReservationPayload) {
  const existing = await getBookingByRef(payload.bookingId);

  if (!existing) {
    return await handleNewBooking(payload);
  }

  const guest = payload.guest;
  const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : existing.guestName;
  const contact = guest?.phone || guest?.email || existing.contact;
  const roomInfo = payload.rooms?.map((r) => r.roomCode).join(", ") || existing.roomType;
  const persons = payload.rooms?.reduce((sum, r) => sum + (r.occupancy?.adults ?? 0) + (r.occupancy?.children ?? 0), 0) || existing.persons;
  const ratePlan = payload.rooms?.[0]?.rateplanCode || existing.ratePlan || "";
  const nightlyRate = payload.rooms?.[0]?.prices?.[0]?.sellRate || existing.nightlyRate || 0;

  const closed = existing.status === "checked_out" || existing.status === "no_show" || existing.status === "cancelled";
  const newCheckin = payload.checkin || existing.checkinDate;
  const newCheckout = exclusiveEndDate(newCheckin, payload.checkout || existing.checkoutDate);
  let moveDates = !closed && !!newCheckin && !!newCheckout;
  if (moveDates && newCheckin && newCheckout) {
    const aligned = await realignAssignments(existing.id, newCheckin, newCheckout);
    if (!aligned) moveDates = false;
  }

  await updateBookingFull(existing.id, {
    guestName,
    contact: contact || "",
    platform: payload.channel || existing.platform,
    ...(moveDates ? {
      checkinDate: newCheckin,
      checkoutDate: payload.checkout || existing.checkoutDate || "",
    } : {}),
    roomType: roomInfo || "",
    persons,
    paymentStatus: payload.pah !== undefined ? (payload.pah ? "pay_at_hotel" : "prepaid") : (existing.paymentStatus || "unknown"),
    specialRequests: payload.specialRequests || existing.specialRequests || "",
    status: existing.status,
    rawData: JSON.stringify(payload),
    amountBeforeTax: payload.amount?.amountBeforeTax ?? existing.amountBeforeTax ?? 0,
    amountTax: payload.amount?.tax ?? existing.amountTax ?? 0,
    amountTotal: payload.amount?.amountAfterTax ?? existing.amountTotal ?? 0,
    currency: payload.amount?.currency || existing.currency || "INR",
    email: guest?.email || existing.email || "",
    cmBookingId: payload.cmBookingId || existing.cmBookingId || "",
    ratePlan,
    nightlyRate,
  });

  await addBookingHistoryEntry({
    bookingId: existing.id,
    action: "Modified from Channel",
    details: `Booking modified via ${payload.channel || "aiosell"}`,
    performedBy: "channel_manager",
  });

  return respondSuccess("Reservation Modified Successfully");
}

async function handleCancelBooking(payload: ReservationPayload) {
  const existing = await getBookingByRef(payload.bookingId);

  if (!existing) {
    return respondSuccess("Reservation not found (may already be cancelled)");
  }

  if (existing.status === "cancelled") {
    return respondSuccess("Reservation already cancelled");
  }

  const now = new Date().toISOString();

  const detail = await getBookingDetail(existing.id);
  const assigned = (detail?.assignments || []).filter((a) => a.status === "assigned");
  const fromAssignments = assigned.flatMap((a) => occupiedNights(a.checkinDate, a.checkoutDate));
  const fromBooking = occupiedNights(existing.checkinDate, existing.checkoutDate);
  const affectedDates = [...new Set(fromAssignments.length ? fromAssignments : fromBooking)];

  await updateBookingFull(existing.id, {
    status: "cancelled",
    cancelledAt: now,
    cancelledBy: "channel_manager",
  });
  await unassignBookingBeds(existing.id);
  await addBookingHistoryEntry({
    bookingId: existing.id,
    action: "Cancelled from Channel",
    details: `Cancelled via ${payload.channel || "aiosell"}`,
    performedBy: "channel_manager",
  });
  if (affectedDates.length > 0) {
    await triggerInventoryPush(affectedDates).catch(() => {});
  }

  return respondSuccess("Reservation Cancelled Successfully");
}

async function realignAssignments(bookingId: number, newCheckin: string, newCheckout: string): Promise<boolean> {
  const detail = await getBookingDetail(bookingId);
  const status = detail?.booking?.status;
  if (status === "checked_out" || status === "no_show" || status === "cancelled") return false;
  const assigned = (detail?.assignments || []).filter((a) => a.status === "assigned");
  if (assigned.length === 0) return true;
  const same = assigned.every((a) => a.checkinDate === newCheckin && a.checkoutDate === newCheckout);
  if (same) return true;

  for (const a of assigned) {
    if (!(await checkBedAvailability(a.bedId, newCheckin, newCheckout, bookingId))) {
      return false;
    }
  }
  await unassignBookingBeds(bookingId);
  for (const a of assigned) {
    await assignBedToBooking({
      bookingId,
      bedId: a.bedId,
      dormId: a.dormId,
      checkinDate: newCheckin,
      checkoutDate: newCheckout,
      assignedBy: "channel_manager",
      inventoryPool: a.inventoryPool || "online",
    });
  }
  return true;
}
