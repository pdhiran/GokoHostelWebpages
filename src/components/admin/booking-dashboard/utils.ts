export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  received: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  checked_in: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  checked_out: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  hold: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-300 dark:border-pink-700" },
  no_show: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600" },
  cancelled: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  modified: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-300 dark:border-yellow-700" },
};

export const PLATFORM_LOGOS: Record<string, { label: string; abbr: string; color: string }> = {
  booking_com: { label: "Booking.com", abbr: "B", color: "bg-blue-600" },
  makemytrip: { label: "MakeMyTrip", abbr: "M", color: "bg-red-500" },
  goibibo: { label: "Goibibo", abbr: "G", color: "bg-orange-500" },
  hostelworld: { label: "Hostelworld", abbr: "H", color: "bg-orange-600" },
  booking_engine: { label: "Website", abbr: "W", color: "bg-green-600" },
  walkin: { label: "Walk-in", abbr: "WI", color: "bg-gray-500" },
  direct: { label: "Direct", abbr: "D", color: "bg-teal-500" },
  channel_manager: { label: "Channel Manager", abbr: "CM", color: "bg-indigo-500" },
};

export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  hold: "On Hold",
  no_show: "No Show",
  cancelled: "Cancelled",
  modified: "Modified",
};

export function getHostelToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getDateRange(mode: "week" | "10days" | "30days"): { start: string; end: string } {
  const today = new Date(getHostelToday() + "T12:00:00Z");
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const start = yesterday.toISOString().split("T")[0];

  let days = 7;
  if (mode === "10days") days = 10;
  if (mode === "30days") days = 30;

  const endDate = new Date(yesterday);
  endDate.setUTCDate(endDate.getUTCDate() + days - 1);

  return { start, end: endDate.toISOString().split("T")[0] };
}

export function getDatesArray(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T12:00:00Z");
  const endDate = new Date(end + "T12:00:00Z");
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function getNights(checkin: string, checkout: string): number {
  const ci = new Date(checkin + "T12:00:00Z");
  const co = new Date(checkout + "T12:00:00Z");
  return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
}

export function calculateTax(amount: number, taxRate: number = 0.12): { beforeTax: number; tax: number; total: number } {
  const tax = Math.round(amount * taxRate);
  return { beforeTax: amount, tax, total: amount + tax };
}

export function formatCurrency(amount: number): string {
  return `\u20B9${amount.toLocaleString("en-IN")}`;
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDate();
  const mon = d.toLocaleDateString("en", { month: "short", timeZone: "UTC" });
  const wd = d.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
  return `${wd} ${day} ${mon}`;
}

export function formatDateCompact(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${d.getUTCDate()} ${d.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getHostelToday();
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}
