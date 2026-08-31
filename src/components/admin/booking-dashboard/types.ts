export type BookingStatus = "received" | "checked_in" | "checked_out" | "hold" | "no_show" | "cancelled" | "modified";

export type BookingPlatform = "booking_com" | "makemytrip" | "goibibo" | "hostelworld" | "booking_engine" | "walkin" | "direct" | "channel_manager";

export type DashboardBooking = {
  id: number;
  guestName: string;
  contact: string;
  email: string;
  platform: string;
  bookingRef: string;
  cmBookingId: string;
  gokoBookingId: string;
  checkinDate: string;
  checkoutDate: string;
  roomType: string;
  ratePlan: string;
  persons: number;
  status: BookingStatus;
  source: string;
  specialRequests: string;
  amountBeforeTax: number;
  amountTax: number;
  amountTotal: number;
  amountPaid: number;
  paymentStatus: string;
  nightlyRate: number;
  currency: string;
  holdExpiresAt: string;
  cancelledAt: string;
  cancelledBy: string;
  checkedInAt: string;
  checkedInBy: string;
  checkedOutAt: string;
  checkedOutBy: string;
  createdAt: string;
  nights: number;
  balance: number;
  requestedRoomCodes?: string[];
  requestedDormIds?: number[];
  requestedDormNames?: string[];
  requestedBedCount?: number;
  requestedNeedLabels?: string;
  requestedNeeds?: Array<{ dormId: number; count: number; name: string }>;
  rawData?: string;
};

export type BedAssignment = {
  id: number;
  bookingId: number;
  bedId: number;
  dormId: number;
  dormName: string;
  bedLabel: string;
  checkinDate: string;
  checkoutDate: string;
  status: "assigned" | "unassigned" | "cancelled";
  assignedBy: string;
  assignedAt: string;
};

export type BookingHistoryEntry = {
  id: number;
  bookingId: number;
  action: string;
  details: string;
  performedBy: string;
  performedAt: string;
};

export type CalendarDorm = {
  id: number;
  name: string;
  collapsed: boolean;
  beds: CalendarBed[];
};

export type CalendarBed = {
  id: number;
  bedId: string;
  dormId: number;
  dormName: string;
  isBlocked: boolean;
};

export type DateRange = {
  startDate: string;
  endDate: string;
  mode: "week" | "10days" | "30days" | "custom";
};
