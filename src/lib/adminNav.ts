import type { AdminSection } from "@/components/admin/types";

export const ADMIN_NAV: AdminSection[] = [
  "dashboard", "bookings", "beds", "timeline", "inventory", "records", "foodOrders", "expenditure", "reviews", "management",
];

export const ADMIN_NAV_PERMS: Record<AdminSection, string> = {
  dashboard: "canViewDashboard", bookings: "canViewBookings", beds: "canViewBeds",
  timeline: "canViewTimeline", inventory: "canManageInventory", records: "canViewRecords", foodOrders: "canViewFoodOrders",
  expenditure: "canViewAccounts", reviews: "canViewReviews", management: "canViewManagement",
};

export function firstVisibleAdminSection(
  role: string,
  permissions: Record<string, boolean>,
  current: AdminSection,
): AdminSection | null {
  if (role === "admin") return current;
  const isVisible = (id: AdminSection) => Boolean(permissions[ADMIN_NAV_PERMS[id]]);
  if (isVisible(current)) return current;
  return ADMIN_NAV.find(isVisible) ?? null;
}
