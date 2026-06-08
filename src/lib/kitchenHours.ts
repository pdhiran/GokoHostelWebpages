export interface KitchenSlot {
  open: string;
  close: string;
}

export interface KitchenStatus {
  open: boolean;
  nextOpenAt?: string;
}

function getISTDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseKitchenHours(hoursStr: string): KitchenSlot[] {
  if (!hoursStr || !hoursStr.trim()) return [];
  return hoursStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((slot) => {
      const [open, close] = slot.split("-").map((t) => t.trim());
      return { open: open || "00:00", close: close || "00:00" };
    });
}

export function formatSlotsForDisplay(slots: KitchenSlot[]): string {
  return slots
    .map((s) => {
      const openMin = timeToMinutes(s.open);
      const closeMin = timeToMinutes(s.close);
      return `${formatTimeForHumans(openMin)} - ${formatTimeForHumans(closeMin)}`;
    })
    .join(", ");
}

function formatTimeForHumans(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function slotsToString(slots: KitchenSlot[]): string {
  return slots.map((s) => `${s.open}-${s.close}`).join(",");
}

export function isKitchenOpen(hoursStr: string): KitchenStatus {
  const slots = parseKitchenHours(hoursStr);
  if (slots.length === 0) return { open: false };

  const ist = getISTDate();
  const currentMinutes = ist.getHours() * 60 + ist.getMinutes();

  for (const slot of slots) {
    const openMin = timeToMinutes(slot.open);
    const closeMin = timeToMinutes(slot.close);
    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      return { open: true };
    }
  }

  const sortedSlots = [...slots].sort(
    (a, b) => timeToMinutes(a.open) - timeToMinutes(b.open)
  );

  for (const slot of sortedSlots) {
    const openMin = timeToMinutes(slot.open);
    if (openMin > currentMinutes) {
      return { open: false, nextOpenAt: minutesToTime(openMin) };
    }
  }

  return { open: false, nextOpenAt: minutesToTime(timeToMinutes(sortedSlots[0].open)) };
}
