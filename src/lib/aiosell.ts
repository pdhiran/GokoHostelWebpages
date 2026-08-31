/**
 * Aiosell Channel Manager API Client
 * Handles outbound push (rates, inventory, restrictions, no-show)
 * and inbound webhook parsing (reservations).
 */

import { logPmsCall } from "@/lib/pmsLog";

export type AiosellConfig = {
  hotelCode: string;
  pmsId: string;
  apiBaseUrl: string;
  apiUsername: string;
  apiPassword: string;
};

export type AiosellResponse = {
  success: boolean;
  message?: string;
  warnings?: string[];
};

export type InventoryUpdate = {
  startDate: string;
  endDate: string;
  rooms: Array<{ roomCode: string; available: number }>;
};

export type InventoryRestrictionUpdate = {
  startDate: string;
  endDate: string;
  rooms: Array<{
    roomCode: string;
    restrictions: RestrictionFields;
  }>;
};

export type RateUpdate = {
  startDate: string;
  endDate: string;
  rates: Array<{ roomCode: string; rateplanCode: string; rate: number }>;
};

export type RateRestrictionUpdate = {
  startDate: string;
  endDate: string;
  rates: Array<{
    roomCode: string;
    rateplanCode: string;
    restrictions: RestrictionFields | RestrictionPatch;
  }>;
};

export type RestrictionFields = {
  stopSell: boolean;
  minimumStay: number | null;
  maximumStay: number | null;
  closeOnArrival: boolean;
  closeOnDeparture: boolean;
  minimumAdvanceReservation: number | null;
  maximumAdvanceReservation: number | null;
  minimumStayArrival: number | null;
  maximumStayArrival: number | null;
  exactStayArrival: number | null;
};

/** Aiosell restriction fields are optional (merge). Bulk UI sends only the one staff set. */
export type RestrictionPatch = Partial<RestrictionFields>;

export function restrictionPatch(restrictionType: string, value: unknown): RestrictionPatch | null {
  switch (restrictionType) {
    case "stopSell": return { stopSell: Boolean(value) };
    case "closeOnArrival": return { closeOnArrival: Boolean(value) };
    case "closeOnDeparture": return { closeOnDeparture: Boolean(value) };
    case "minimumStay": return { minimumStay: asStayNumber(value) };
    case "maximumStay": return { maximumStay: asStayNumber(value) };
    case "minimumAdvanceReservation": return { minimumAdvanceReservation: asStayNumber(value) };
    case "maximumAdvanceReservation": return { maximumAdvanceReservation: asStayNumber(value) };
    default: return null;
  }
}

function asStayNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type ReservationPayload = {
  action: "book" | "modify" | "cancel";
  hotelCode: string;
  channel: string;
  bookingId: string;
  cmBookingId?: string;
  bookedOn?: string;
  checkin?: string;
  checkout?: string;
  segment?: string;
  specialRequests?: string;
  pah?: boolean;
  amount?: {
    amountAfterTax: number;
    amountBeforeTax: number;
    tax: number;
    currency: string;
  };
  guest?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  };
  rooms?: Array<{
    roomCode: string;
    rateplanCode: string;
    guestName: string;
    occupancy: { adults: number; children: number };
    prices: Array<{ date: string; sellRate: number }>;
  }>;
};

function buildAuthHeader(config: AiosellConfig): string {
  const encoded = btoa(`${config.apiUsername}:${config.apiPassword}`);
  return `Basic ${encoded}`;
}

type AiosellCallType = "inventory" | "rate" | "restriction" | "noshow" | "reservation";

async function aiosellFetch(
  url: string,
  config: AiosellConfig,
  body: Record<string, unknown>,
  meta: { type: AiosellCallType; recordsAffected?: number; source?: string }
): Promise<AiosellResponse> {
  const started = Date.now();
  const log = (entry: {
    status: "success" | "failed";
    httpStatus: number;
    response?: unknown;
    errorMessage?: string;
  }) =>
    logPmsCall({
      direction: "push",
      type: meta.source ? `${meta.type} (${meta.source})` : meta.type,
      status: entry.status,
      request: body,
      response: entry.response,
      errorMessage: entry.errorMessage,
      recordsAffected: meta.recordsAffected,
      httpMethod: "POST",
      url,
      httpStatus: entry.httpStatus,
      durationMs: Date.now() - started,
    }).catch(() => {});

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const result: AiosellResponse = {
        success: false,
        message: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
      await log({ status: "failed", httpStatus: response.status, response: result, errorMessage: result.message });
      return result;
    }

    let data: AiosellResponse;
    try {
      data = await response.json() as AiosellResponse;
    } catch {
      const message = `HTTP ${response.status}: invalid JSON response`;
      await log({ status: "failed", httpStatus: response.status, errorMessage: message });
      return { success: false, message };
    }

    await log({
      status: data.success === false ? "failed" : "success",
      httpStatus: response.status,
      response: data,
      errorMessage: data.success === false ? (data.message || "") : "",
    });
    return data;
  } catch (error: any) {
    const message = error?.message || "Network error";
    await log({ status: "failed", httpStatus: 0, errorMessage: message });
    return { success: false, message };
  }
}

export async function pushInventory(
  config: AiosellConfig,
  updates: InventoryUpdate[],
  toChannels?: string[],
  source?: string
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update/${config.pmsId}`;
  const body: Record<string, unknown> = {
    hotelCode: config.hotelCode,
    updates,
  };
  if (toChannels?.length) body.toChannels = toChannels;
  const recordsAffected = updates.reduce((sum, u) => sum + u.rooms.length, 0);
  return aiosellFetch(url, config, body, { type: "inventory", recordsAffected, source });
}

export async function pushInventoryRestrictions(
  config: AiosellConfig,
  updates: InventoryRestrictionUpdate[],
  toChannels?: string[]
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update/${config.pmsId}`;
  const body: Record<string, unknown> = {
    hotelCode: config.hotelCode,
    updates,
  };
  if (toChannels?.length) body.toChannels = toChannels;
  const recordsAffected = updates.reduce((sum, u) => sum + u.rooms.length, 0);
  return aiosellFetch(url, config, body, { type: "restriction", recordsAffected });
}

export async function pushRates(
  config: AiosellConfig,
  updates: RateUpdate[]
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update-rates/${config.pmsId}`;
  const recordsAffected = updates.reduce((sum, u) => sum + u.rates.length, 0);
  return aiosellFetch(url, config, {
    hotelCode: config.hotelCode,
    updates,
  }, { type: "rate", recordsAffected });
}

export async function pushRateRestrictions(
  config: AiosellConfig,
  updates: RateRestrictionUpdate[],
  toChannels?: string[]
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update-rates/${config.pmsId}`;
  const body: Record<string, unknown> = {
    hotelCode: config.hotelCode,
    updates,
  };
  if (toChannels?.length) body.toChannels = toChannels;
  const recordsAffected = updates.reduce((sum, u) => sum + u.rates.length, 0);
  return aiosellFetch(url, config, body, { type: "restriction", recordsAffected });
}

export async function pushNoShow(
  config: AiosellConfig,
  bookingId: string,
  partner: string
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/noshow`;
  return aiosellFetch(url, config, {
    hotelCode: config.hotelCode,
    bookingId,
    partner,
  }, { type: "noshow", recordsAffected: 1 });
}

export async function fetchFromAiosell(
  config: AiosellConfig,
  type: "inventory" | "rates" | "reservation",
  startDate: string,
  endDate: string
): Promise<AiosellResponse & { data?: unknown }> {
  const url = `${config.apiBaseUrl}/api/v2/cm/data/${config.pmsId}`;
  const callType: AiosellCallType = type === "rates" ? "rate" : type === "reservation" ? "reservation" : "inventory";
  const result = await aiosellFetch(url, config, {
    type,
    hotelCode: config.hotelCode,
    startDate,
    endDate,
  }, { type: callType });
  return result as AiosellResponse & { data?: unknown };
}

export function parseReservationPayload(body: unknown): ReservationPayload | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  const action = data.action as string;
  if (!["book", "modify", "cancel"].includes(action)) return null;
  if (!data.hotelCode || !data.bookingId) return null;

  return data as unknown as ReservationPayload;
}

