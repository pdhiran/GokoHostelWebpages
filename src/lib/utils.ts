import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a Date as YYYY-MM-DD in IST. Safe on both client and server (CF Workers/UTC). */
export function localDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Current date in IST (YYYY-MM-DD). Safe on both client (browser) and server (CF Workers/UTC). */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
