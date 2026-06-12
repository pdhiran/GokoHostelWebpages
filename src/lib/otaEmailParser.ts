/**
 * OTA Email Parser — extracts booking details from MakeMyTrip, Booking.com, and Hostelworld emails.
 */

import type { GmailMessage } from "./googleApiFetch";

export type ParsedBooking = {
  guestName: string;
  contact: string;
  platform: string;
  bookingRef: string;
  checkinDate: string;
  checkoutDate: string;
  roomType: string;
  persons: number;
  paymentStatus: string;
  specialRequests: string;
  property?: string;
};

const OTA_SENDERS: Record<string, string> = {
  "makemytrip": "makemytrip.com",
  "booking_com": "booking.com",
  "hostelworld": "hostelworld.com",
  "stayflexi": "stayflexi.com",
};

export function identifyPlatform(from: string, subject?: string): string | null {
  const lower = from.toLowerCase();
  if (lower.includes("makemytrip")) return "makemytrip";
  if (lower.includes("booking.com")) return "booking_com";
  if (lower.includes("hostelworld")) return "hostelworld";
  if (lower.includes("stayflexi")) {
    return identifyPlatformFromContent(subject || "");
  }
  return null;
}

function identifyPlatformFromContent(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("booking.com")) return "booking_com";
  if (lower.includes("makemytrip")) return "makemytrip";
  if (lower.includes("hostelworld")) return "hostelworld";
  return "booking_com";
}

export function isBookingEmail(message: GmailMessage): boolean {
  const subject = message.subject.toLowerCase();
  const from = message.from.toLowerCase();

  const bookingKeywords = ["booking confirmation", "reservation confirmed", "new booking", "new reservation", "booking id", "booking reference"];
  const isFromOTA = Object.values(OTA_SENDERS).some((domain) => from.includes(domain));
  const hasKeyword = bookingKeywords.some((kw) => subject.includes(kw));

  if (from.includes("stayflexi.com")) {
    const stayflexiKeywords = ["booking confirmed", "new booking", "booking from"];
    return stayflexiKeywords.some((kw) => subject.includes(kw));
  }

  return isFromOTA && hasKeyword;
}

export function parseBookingEmail(message: GmailMessage): ParsedBooking | null {
  const from = message.from.toLowerCase();
  const rawBody = message.body;
  const body = stripHtml(rawBody);
  const subject = message.subject;
  const isStayFlexi = from.includes("stayflexi.com");

  const platform = identifyPlatform(message.from, subject);
  if (!platform) return null;

  try {
    if (isStayFlexi) {
      return parseStayFlexi(body, subject, platform, message.from);
    }

    switch (platform) {
      case "makemytrip":
        return parseMakeMyTrip(body, subject);
      case "booking_com":
        return parseBookingCom(body, subject);
      case "hostelworld":
        return parseHostelworld(body, subject);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseMakeMyTrip(body: string, subject: string): ParsedBooking {
  const guestName = extractBetween(body, "Guest Name", "\n") || extractBetween(body, "guest name", "\n") || "Unknown Guest";
  const bookingRef = extractPattern(body, /(?:Booking ID|booking id|Confirmation No)[:\s]*([A-Z0-9\-]+)/i) || "";
  const checkinDate = extractDate(body, "check.?in") || "";
  const checkoutDate = extractDate(body, "check.?out") || "";
  const roomType = extractBetween(body, "Room Type", "\n") || extractBetween(body, "room type", "\n") || "";
  const persons = parseInt(extractPattern(body, /(\d+)\s*(?:guest|person|pax)/i) || "1", 10);
  const contact = extractPattern(body, /(?:phone|mobile|contact)[:\s]*([+\d\s\-]+)/i) || "";

  return {
    guestName: guestName.replace(/[:\-]/g, "").trim(),
    contact: contact.trim(),
    platform: "makemytrip",
    bookingRef,
    checkinDate,
    checkoutDate,
    roomType: roomType.replace(/[:\-]/g, "").trim(),
    persons,
    paymentStatus: body.toLowerCase().includes("paid") ? "paid" : "pay_at_property",
    specialRequests: extractBetween(body, "Special Request", "\n") || "",
  };
}

function parseBookingCom(body: string, subject: string): ParsedBooking {
  const guestName = extractPattern(body, /(?:Guest name|Booked by)[:\s]*([^\n<]+)/i) || extractPattern(subject, /from\s+(.+?)(?:\s*-|\s*$)/i) || "Unknown Guest";
  const bookingRef = extractPattern(body, /(?:Confirmation|Booking|Reservation)\s*(?:number|#|no\.?)[:\s]*(\d+)/i) || "";
  const checkinDate = extractDate(body, "check.?in|arrival") || "";
  const checkoutDate = extractDate(body, "check.?out|departure") || "";
  const roomType = extractPattern(body, /(?:Room|Bed|Accommodation)[:\s]*([^\n<]+)/i) || "";
  const persons = parseInt(extractPattern(body, /(\d+)\s*(?:guest|person|adult)/i) || "1", 10);
  const contact = extractPattern(body, /(?:phone|tel|mobile)[:\s]*([+\d\s\-()]+)/i) || "";

  return {
    guestName: guestName.trim(),
    contact: contact.trim(),
    platform: "booking_com",
    bookingRef,
    checkinDate,
    checkoutDate,
    roomType: roomType.trim(),
    persons,
    paymentStatus: body.toLowerCase().includes("prepaid") || body.toLowerCase().includes("paid online") ? "paid" : "pay_at_property",
    specialRequests: extractPattern(body, /(?:special request|guest request)[:\s]*([^\n<]+)/i) || "",
  };
}

function parseHostelworld(body: string, subject: string): ParsedBooking {
  const guestName = extractPattern(body, /(?:Guest|Name|Traveller)[:\s]*([^\n<]+)/i) || "Unknown Guest";
  const bookingRef = extractPattern(body, /(?:Booking|Reservation)\s*(?:ID|#|ref|number)[:\s]*([A-Z0-9\-]+)/i) || "";
  const checkinDate = extractDate(body, "check.?in|arrival|from") || "";
  const checkoutDate = extractDate(body, "check.?out|departure|to") || "";
  const roomType = extractPattern(body, /(?:Bed|Room|Dorm)[:\s]*([^\n<]+)/i) || "Dorm Bed";
  const persons = parseInt(extractPattern(body, /(\d+)\s*(?:bed|guest|person)/i) || "1", 10);

  return {
    guestName: guestName.trim(),
    contact: "",
    platform: "hostelworld",
    bookingRef,
    checkinDate,
    checkoutDate,
    roomType: roomType.trim(),
    persons,
    paymentStatus: "partial",
    specialRequests: "",
  };
}

function parseStayFlexi(body: string, subject: string, platform: string, from: string): ParsedBooking {
  const guestName =
    extractPattern(body, /confirmed for\s+([^,\n<]+)/i) ||
    extractPattern(body, /(?:Name)\s+([^\n<]+)/i) ||
    "Unknown Guest";

  const bookingRef =
    extractPattern(subject, /Itinerary\s*#\s*([A-Z0-9_]+)/i) ||
    extractPattern(body, /(?:Confirmation code)\s+([A-Z0-9_]+)/i) ||
    "";

  const otaRef = extractPattern(body, /BOOKING\.COM\s+Confirmation\s+code\s+(\d+)/i) || "";

  const checkinDate =
    extractStayFlexiDate(subject, "from") ||
    extractDate(body, "check.?in") ||
    "";
  const checkoutDate =
    extractStayFlexiDate(subject, "to") ||
    extractDate(body, "check.?out") ||
    "";

  const roomType = extractPattern(body, /Room:\s*([^\n<,]+)/i) || "";

  const personsMatch = body.match(/(\d+)\s*Adult\(s\)/i);
  const persons = personsMatch ? parseInt(personsMatch[1], 10) : 1;

  const contact = extractGuestContact(body);

  const totalPayments = extractPattern(body, /Total\s+payments\s+([^\n<]+)/i) || "";
  const isPaid = totalPayments ? !totalPayments.includes("0.0") : false;

  const property = identifyProperty(from, body);

  return {
    guestName: guestName.trim(),
    contact: contact.trim(),
    platform,
    bookingRef: bookingRef || otaRef,
    checkinDate,
    checkoutDate,
    roomType: roomType.trim(),
    persons,
    paymentStatus: isPaid ? "paid" : "pay_at_property",
    specialRequests: "",
    property,
  };
}

function extractGuestContact(body: string): string {
  const customerSection = body.match(/Customer details([\s\S]*?)(?:Accomodation details|Room details|$)/i);
  if (customerSection) {
    const section = customerSection[1];
    const phone = extractPattern(section, /(?:Phone|Mobile|Contact)\s+([+\d\s\-()]+)/i);
    if (phone) return phone.trim();
    const email = extractPattern(section, /(?:Email)\s+([^\s\n]+@[^\s\n]+)/i);
    if (email) return email.trim();
  }
  return "";
}

function identifyProperty(from: string, body: string): string {
  const fromLower = from.toLowerCase();
  if (fromLower.includes("sunny") || fromLower.includes("paradise")) return "sunnys_paradise";
  if (fromLower.includes("goko")) return "goko_hostel";

  const accomName = extractPattern(body, /Accomodation details[\s\S]*?Name\s+([^\n<]+)/i);
  if (accomName) {
    const lower = accomName.toLowerCase().trim();
    if (lower.includes("sunny") || lower.includes("paradise")) return "sunnys_paradise";
    if (lower.includes("goko")) return "goko_hostel";
  }
  return "goko_hostel";
}

function extractStayFlexiDate(text: string, keyword: string): string {
  const regex = new RegExp(`${keyword}\\s+(\\w{3,9}\\s+\\d{1,2},?\\s+\\d{4})`, "i");
  const match = text.match(regex);
  if (!match) return "";
  try {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return formatLocalDate(d);
  } catch {}
  return match[1];
}

// --- Utility helpers ---

function stripHtml(html: string): string {
  if (!html.includes("<")) return html;
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return text;
}

function extractBetween(text: string, startKey: string, endKey: string): string | null {
  const regex = new RegExp(`${startKey}[:\\s]*([^\\n<]+?)(?:${endKey}|$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractPattern(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function extractDate(text: string, contextKey: string): string {
  const contextRegex = new RegExp(`${contextKey}[^\\n]*?(\\d{1,2}[\\s/\\-]\\w{3,9}[\\s/\\-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})`, "i");
  const match = text.match(contextRegex);
  if (!match) return "";

  const dateStr = match[1];
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return formatLocalDate(d);
  } catch {}

  return dateStr;
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getOtaSearchQuery(): string {
  return "from:(makemytrip.com OR booking.com OR hostelworld.com OR stayflexi.com) subject:(booking OR reservation OR confirmation) newer_than:7d";
}
