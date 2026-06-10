/**
 * Extract Date of Birth from ID document OCR text.
 * Supports Aadhaar, Driving Licence, and Passport (via MRZ or free-text).
 * Returns DOB in DD/MM/YYYY format, or null if not found.
 */

import { parsePassportMRZ } from "./parsePassportData";

const DATE_PATTERN = /(\d{1,2})[\/.\-\s](\d{1,2})[\/.\-\s](\d{2,4})/;

function normalizeYear(y: string): string {
  if (y.length === 4) return y;
  const n = parseInt(y);
  return n > 50 ? `19${y}` : `20${y}`;
}

function formatDob(dd: string, mm: string, yyyy: string): string {
  return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
}

function extractDateAfterLabel(text: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\d]{0,40}?${DATE_PATTERN.source}`, "i");
    const m = text.match(regex);
    if (m) {
      return formatDob(m[1], m[2], normalizeYear(m[3]));
    }
  }
  return null;
}

function parseAadhaarDob(text: string): string | null {
  const labels = [
    "DOB\\s*:?",
    "D\\.?O\\.?B\\.?\\s*:?",
    "date\\s*of\\s*birth\\s*:?",
    "birth\\s*:?",
    "जन्म\\s*(?:तिथि|दिनांक)\\s*:?",
    "जन्मतिथि\\s*:?",
  ];
  const result = extractDateAfterLabel(text, ...labels);
  if (result) return result;

  const yobMatch = text.match(/(?:year\s*of\s*birth|YOB)\s*:?\s*(\d{4})/i);
  if (yobMatch) {
    return `01/01/${yobMatch[1]}`;
  }

  return null;
}

function parseDrivingLicenceDob(text: string): string | null {
  const labels = [
    "DOB\\s*:?",
    "D\\.?O\\.?B\\.?\\s*:?",
    "date\\s*of\\s*birth\\s*:?",
    "birth\\s*:?",
  ];
  return extractDateAfterLabel(text, ...labels);
}

function parsePassportDob(text: string): string | null {
  const parsed = parsePassportMRZ(text);
  if (parsed.dateOfBirth) return parsed.dateOfBirth;
  return null;
}

export function parseDobFromOcr(ocrText: string, idType: string): string | null {
  if (!ocrText || ocrText.trim().length < 10) return null;

  switch (idType) {
    case "aadhaar":
      return parseAadhaarDob(ocrText);
    case "driving_licence":
      return parseDrivingLicenceDob(ocrText);
    case "passport":
      return parsePassportDob(ocrText);
    default:
      return parseAadhaarDob(ocrText) || parseDrivingLicenceDob(ocrText) || parsePassportDob(ocrText);
  }
}

/**
 * Normalize a DOB string (various formats) to DD/MM/YYYY for comparison.
 */
function normalizeDob(dob: string): string | null {
  if (!dob) return null;
  const slashMatch = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[1].padStart(2, "0")}/${slashMatch[2].padStart(2, "0")}/${slashMatch[3]}`;
  const isoMatch = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`;
  const dashDmy = dob.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashDmy) return `${dashDmy[1].padStart(2, "0")}/${dashDmy[2].padStart(2, "0")}/${dashDmy[3]}`;
  return null;
}

/**
 * Compare two DOB strings for equality after normalizing formats.
 */
export function dobsMatch(dob1: string, dob2: string): boolean {
  const n1 = normalizeDob(dob1);
  const n2 = normalizeDob(dob2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

/**
 * Calculate age from a DOB string in DD/MM/YYYY format.
 * Returns null if the date can't be parsed.
 */
export function getAgeFromDob(dob: string): number | null {
  if (!dob) return null;

  let dd: number, mm: number, yyyy: number;

  const slashMatch = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    dd = parseInt(slashMatch[1]);
    mm = parseInt(slashMatch[2]);
    yyyy = parseInt(slashMatch[3]);
  } else {
    const isoMatch = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      yyyy = parseInt(isoMatch[1]);
      mm = parseInt(isoMatch[2]);
      dd = parseInt(isoMatch[3]);
    } else {
      return null;
    }
  }

  if (yyyy < 1900 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const today = new Date();
  let age = today.getFullYear() - yyyy;
  const monthDiff = (today.getMonth() + 1) - mm;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dd)) {
    age--;
  }
  return age >= 0 ? age : null;
}
