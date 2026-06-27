/**
 * Aiosell Channel Manager API Client
 * Handles outbound push (rates, inventory, restrictions, no-show)
 * and inbound webhook parsing (reservations).
 */

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
    restrictions: RestrictionFields;
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

const SANDBOX_CONFIG: AiosellConfig = {
  hotelCode: "SANDBOX-PMS",
  pmsId: "sample-pms",
  apiBaseUrl: "https://live.aiosell.com",
  apiUsername: "aiosell",
  apiPassword: "AIOsell@123",
};

export function getSandboxConfig(): AiosellConfig {
  return { ...SANDBOX_CONFIG };
}

function buildAuthHeader(config: AiosellConfig): string {
  const encoded = btoa(`${config.apiUsername}:${config.apiPassword}`);
  return `Basic ${encoded}`;
}

async function aiosellFetch(
  url: string,
  config: AiosellConfig,
  body: Record<string, unknown>
): Promise<AiosellResponse> {
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
    return {
      success: false,
      message: `HTTP ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  const data = await response.json() as AiosellResponse;
  return data;
}

export async function pushInventory(
  config: AiosellConfig,
  updates: InventoryUpdate[],
  toChannels?: string[]
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update/${config.pmsId}`;
  const body: Record<string, unknown> = {
    hotelCode: config.hotelCode,
    updates,
  };
  if (toChannels?.length) body.toChannels = toChannels;
  return aiosellFetch(url, config, body);
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
  return aiosellFetch(url, config, body);
}

export async function pushRates(
  config: AiosellConfig,
  updates: RateUpdate[]
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/update-rates/${config.pmsId}`;
  return aiosellFetch(url, config, {
    hotelCode: config.hotelCode,
    updates,
  });
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
  return aiosellFetch(url, config, body);
}

export async function pushNoShow(
  config: AiosellConfig,
  bookingId: string,
  partner: string
): Promise<AiosellResponse> {
  const url = `${config.apiBaseUrl}/api/v2/cm/noshow`;
  return aiosellFetch(url, config, {
    hotelId: config.hotelCode,
    bookingId,
    partner,
  });
}

export function validateWebhookAuth(
  authHeader: string | null,
  expectedSecret: string
): boolean {
  if (!authHeader || !expectedSecret) return false;
  return authHeader === expectedSecret || authHeader === `Bearer ${expectedSecret}`;
}

export function parseReservationPayload(body: unknown): ReservationPayload | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  const action = data.action as string;
  if (!["book", "modify", "cancel"].includes(action)) return null;
  if (!data.hotelCode || !data.bookingId) return null;

  return data as unknown as ReservationPayload;
}

export function buildDefaultRestrictions(): RestrictionFields {
  return {
    stopSell: false,
    minimumStay: 1,
    maximumStay: null,
    closeOnArrival: false,
    closeOnDeparture: false,
    minimumAdvanceReservation: null,
    maximumAdvanceReservation: null,
    minimumStayArrival: null,
    maximumStayArrival: null,
    exactStayArrival: null,
  };
}
