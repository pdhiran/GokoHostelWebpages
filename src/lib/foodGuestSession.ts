import type { GuestInfoData } from "@/components/food/FoodCart";

const SESSION_KEY = "gokoFoodSession";

export function saveFoodGuestSession(guest: GuestInfoData) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(guest));
  } catch {}
}

export function loadFoodGuestSession(): GuestInfoData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestInfoData;
  } catch {
    return null;
  }
}

export function clearFoodGuestSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
