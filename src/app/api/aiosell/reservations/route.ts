import { NextRequest, NextResponse } from "next/server";
import { getChannelConfig, addBooking, updateBookingStatus, updateBookingFull, getAllBookings, addChannelSyncLog } from "@/db/queries";
import { parseReservationPayload, type ReservationPayload } from "@/lib/aiosell";
import { triggerInventoryPush } from "@/lib/aiosellSync";

function respondSuccess(message: string) {
  return NextResponse.json({ success: true, message });
}

function respondError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respondError("Invalid JSON body");
  }

  try {
    const config = await getChannelConfig();
    if (!config || !config.isActive) {
      return respondError("Channel manager not active", 503);
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
    if (!config.webhookSecret) {
      return respondError("Webhook not configured", 503);
    }
    if (authHeader !== config.webhookSecret && authHeader !== `Bearer ${config.webhookSecret}`) {
      return respondError("Unauthorized", 401);
    }

    const payload = parseReservationPayload(body);
    if (!payload) {
      return respondError("Invalid reservation payload: missing action, hotelCode, or bookingId");
    }

    if (payload.hotelCode !== config.hotelCode) {
      return respondError("Invalid hotel code");
    }

    let response: Response;
    try {
      switch (payload.action) {
        case "book":
          response = await handleNewBooking(payload);
          triggerInventoryPush().catch(() => {});
          break;
        case "modify":
          response = await handleModifyBooking(payload);
          break;
        case "cancel":
          response = await handleCancelBooking(payload);
          triggerInventoryPush().catch(() => {});
          break;
        default:
          return respondError(`Unknown action: ${payload.action}`);
      }

      await addChannelSyncLog({
        direction: "pull",
        type: "reservation",
        status: "success",
        requestPayload: JSON.stringify(body),
        recordsAffected: 1,
      });

      return response;
    } catch (processingError: any) {
      await addChannelSyncLog({
        direction: "pull",
        type: "reservation",
        status: "failed",
        requestPayload: JSON.stringify(body),
        errorMessage: processingError?.message || "Processing failed",
      }).catch(() => {});
      throw processingError;
    }
  } catch (error: any) {
    console.error("Reservation webhook error:", error?.message);
    await addChannelSyncLog({
      direction: "pull",
      type: "reservation",
      status: "failed",
      requestPayload: JSON.stringify(body),
      errorMessage: error?.message || "Unknown",
    }).catch(() => {});
    return respondError("Internal error processing reservation", 500);
  }
}

function extractBookingFields(payload: ReservationPayload) {
  const guest = payload.guest;
  const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : "Unknown Guest";
  const contact = guest?.phone || guest?.email || "";
  const roomInfo = payload.rooms?.map((r) => r.roomCode).join(", ") || "";
  const persons = payload.rooms?.reduce((sum, r) => sum + r.occupancy.adults + r.occupancy.children, 0) || 1;
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
  const existingBookings = await getAllBookings();
  const duplicate = existingBookings.find((b) => b.bookingRef === payload.bookingId);
  if (duplicate) {
    return respondSuccess("Reservation already exists (duplicate)");
  }

  await addBooking(extractBookingFields(payload));

  return respondSuccess("Reservation Updated Successfully");
}

async function handleModifyBooking(payload: ReservationPayload) {
  const existingBookings = await getAllBookings();
  const existing = existingBookings.find((b) => b.bookingRef === payload.bookingId);

  if (!existing) {
    return await handleNewBooking(payload);
  }

  const guest = payload.guest;
  const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : existing.guestName;
  const contact = guest?.phone || guest?.email || existing.contact;
  const roomInfo = payload.rooms?.map((r) => r.roomCode).join(", ") || existing.roomType;
  const persons = payload.rooms?.reduce((sum, r) => sum + r.occupancy.adults + r.occupancy.children, 0) || existing.persons;
  const ratePlan = payload.rooms?.[0]?.rateplanCode || existing.ratePlan || "";
  const nightlyRate = payload.rooms?.[0]?.prices?.[0]?.sellRate || existing.nightlyRate || 0;

  await updateBookingFull(existing.id, {
    guestName,
    contact: contact || "",
    platform: payload.channel || existing.platform,
    checkinDate: payload.checkin || existing.checkinDate,
    checkoutDate: payload.checkout || existing.checkoutDate || "",
    roomType: roomInfo || "",
    persons,
    paymentStatus: payload.pah !== undefined ? (payload.pah ? "pay_at_hotel" : "prepaid") : (existing.paymentStatus || "unknown"),
    specialRequests: payload.specialRequests || existing.specialRequests || "",
    status: "received",
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

  return respondSuccess("Reservation Modified Successfully");
}

async function handleCancelBooking(payload: ReservationPayload) {
  const existingBookings = await getAllBookings();
  const existing = existingBookings.find((b) => b.bookingRef === payload.bookingId);

  if (!existing) {
    return respondSuccess("Reservation not found (may already be cancelled)");
  }

  await updateBookingStatus(existing.id, "cancelled");

  return respondSuccess("Reservation Cancelled Successfully");
}
