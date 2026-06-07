/**
 * Normalize a phone number to its last 10 digits for consistent comparison.
 * Strips all non-digit characters, removes country codes (91 for India).
 * Returns empty string if input is invalid (< 7 digits after cleanup).
 */
export function normalizePhone(input: string): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (digits.length < 7) return "";
  if (digits.length > 10 && digits.startsWith("91")) {
    return digits.slice(-10);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Check if two phone numbers match after normalization.
 */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
