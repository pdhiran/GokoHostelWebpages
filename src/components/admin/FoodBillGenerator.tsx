"use client";

import jsPDF from "jspdf";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillOrderItem = {
  itemName: string;
  quantity: number;
  itemPrice: number;
  lineTotal: number;
  status: string;
};

export type BillOrder = {
  orderNumber: string;
  createdAt: string;
  items: BillOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  specialInstructions?: string;
};

export type GuestBillData = {
  guestName: string;
  guestPhone: string;
  roomInfo?: string;
  stayDates?: string;
  orders: BillOrder[];
  grandSubtotal: number;
  grandTax: number;
  grandTotal: number;
  taxRate: number;
  paymentMethod?: string;
  billDate: string;
};

export type CombinedBillData = {
  guests: Array<{
    guestName: string;
    guestPhone: string;
    roomInfo?: string;
    orders: BillOrder[];
    guestSubtotal: number;
    guestTax: number;
    guestTotal: number;
  }>;
  grandSubtotal: number;
  grandTax: number;
  grandTotal: number;
  taxRate: number;
  equalSplitAmount?: number;
  paymentMethod?: string;
  billDate: string;
};

export type DailySummaryData = {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  hostelOrders: number;
  walkinOrders: number;
  hostelRevenue: number;
  walkinRevenue: number;
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  ordersByStatus: Record<string, number>;
  taxCollected: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPaise(paise: number): string {
  const rupees = (paise / 100).toFixed(2);
  const [whole, decimal] = rupees.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `Rs.${withCommas}.${decimal}`;
}

function generateBillNumber(): string {
  return `BILL-${Date.now()}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_ZONE = 30;

const COL_ITEM = MARGIN_LEFT;
const COL_QTY = MARGIN_LEFT + CONTENT_WIDTH * 0.55;
const COL_UNIT = MARGIN_LEFT + CONTENT_WIDTH * 0.7;
const COL_TOTAL = MARGIN_LEFT + CONTENT_WIDTH * 0.85;

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - FOOTER_ZONE) {
    doc.addPage();
    return 20;
  }
  return y;
}

function drawHorizontalLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
}

function drawHeader(doc: jsPDF, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("GOKO HOSTEL GOKARNA", PAGE_WIDTH / 2, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Beach-side Dining", PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Gokarna, Karnataka, India", PAGE_WIDTH / 2, y, { align: "center" });
  y += 4;
  doc.text("WhatsApp: +91 94837 88886", PAGE_WIDTH / 2, y, { align: "center" });
  y += 4;

  drawHorizontalLine(doc, y);
  return y + 4;
}

function drawFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Thank you for dining with us!", PAGE_WIDTH / 2, PAGE_HEIGHT - 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("This is a computer-generated bill", PAGE_WIDTH / 2, PAGE_HEIGHT - 13, { align: "center" });
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 9, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }
}

function drawTableHeader(doc: jsPDF, y: number): number {
  y = checkPageBreak(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 7, "F");
  doc.text("Item", COL_ITEM + 2, y);
  doc.text("Qty", COL_QTY, y, { align: "center" });
  doc.text("Unit (Rs.)", COL_UNIT, y, { align: "right" });
  doc.text("Total (Rs.)", PAGE_WIDTH - MARGIN_RIGHT - 2, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  return y + 6;
}

function drawItemRow(doc: jsPDF, y: number, item: BillOrderItem): number {
  y = checkPageBreak(doc, y, 6);
  const isVoided = item.status === "voided";

  doc.setFontSize(9);
  if (isVoided) {
    doc.setTextColor(160, 160, 160);
  }

  const nameText = isVoided ? `${item.itemName} (VOIDED)` : item.itemName;

  const maxNameWidth = COL_QTY - COL_ITEM - 8;
  const lines = doc.splitTextToSize(nameText, maxNameWidth);
  doc.text(lines, COL_ITEM + 2, y);

  doc.text(String(item.quantity), COL_QTY, y, { align: "center" });
  doc.text(formatPaise(item.itemPrice), COL_UNIT, y, { align: "right" });
  doc.text(formatPaise(item.lineTotal), PAGE_WIDTH - MARGIN_RIGHT - 2, y, { align: "right" });

  if (isVoided) {
    const textWidth = doc.getTextWidth(lines[0]);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(COL_ITEM + 2, y - 1.5, COL_ITEM + 2 + textWidth, y - 1.5);
  }

  doc.setTextColor(0, 0, 0);
  return y + (lines.length > 1 ? lines.length * 4 + 2 : 5);
}

// ─── Guest Bill ──────────────────────────────────────────────────────────────

export function generateGuestBill(data: GuestBillData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 20;

  y = drawHeader(doc, y);

  // Bill info — right-aligned
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  doc.text(`Bill Date: ${data.billDate}`, rightX, y, { align: "right" });
  y += 4;
  doc.text(`Bill #: ${generateBillNumber()}`, rightX, y, { align: "right" });
  y += 8;

  // Guest info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Guest Details", MARGIN_LEFT, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Name: ${data.guestName}`, MARGIN_LEFT, y);
  y += 4;
  doc.text(`Phone: ${data.guestPhone}`, MARGIN_LEFT, y);
  y += 4;
  if (data.roomInfo) {
    doc.text(`Room/Bed: ${data.roomInfo}`, MARGIN_LEFT, y);
    y += 4;
  }
  if (data.stayDates) {
    doc.text(`Stay: ${data.stayDates}`, MARGIN_LEFT, y);
    y += 4;
  }
  y += 3;
  drawHorizontalLine(doc, y);
  y += 6;

  // Orders
  for (const order of data.orders) {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const orderDate = new Date(order.createdAt);
    const dateStr = orderDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Order ${order.orderNumber}`, MARGIN_LEFT, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(dateStr, rightX, y, { align: "right" });
    y += 5;

    y = drawTableHeader(doc, y);

    for (const item of order.items) {
      y = drawItemRow(doc, y, item);
    }

    if (order.specialInstructions) {
      y = checkPageBreak(doc, y, 6);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Note: ${order.specialInstructions}`, MARGIN_LEFT + 2, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 5;
    }

    y += 2;
    drawHorizontalLine(doc, y);
    y += 6;
  }

  // Totals
  y = checkPageBreak(doc, y, 30);
  const totalsX = PAGE_WIDTH - MARGIN_RIGHT - 2;
  const labelsX = totalsX - 50;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal:", labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandSubtotal), totalsX, y, { align: "right" });
  y += 5;

  doc.text(`Tax (${data.taxRate}%):`, labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandTax), totalsX, y, { align: "right" });
  y += 5;

  drawHorizontalLine(doc, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Grand Total:", labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandTotal), totalsX, y, { align: "right" });
  y += 7;

  if (data.paymentMethod) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Method: ${data.paymentMethod}`, labelsX, y, { align: "right" });
    y += 5;
  }

  drawFooter(doc);

  const filename = `Goko-Bill-${sanitizeFilename(data.guestName)}-${data.billDate.replace(/[\s,]/g, "-")}.pdf`;
  doc.save(filename);
}

// ─── Combined Bill ───────────────────────────────────────────────────────────

export function generateCombinedBill(data: CombinedBillData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 20;

  y = drawHeader(doc, y);

  // Combined bill label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COMBINED BILL", PAGE_WIDTH / 2, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rightX = PAGE_WIDTH - MARGIN_RIGHT;
  doc.text(`Bill Date: ${data.billDate}`, rightX, y, { align: "right" });
  y += 4;
  doc.text(`Bill #: ${generateBillNumber()}`, rightX, y, { align: "right" });
  y += 6;

  // Guest names listed
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Guests:", MARGIN_LEFT, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const guest of data.guests) {
    y = checkPageBreak(doc, y, 5);
    const info = guest.roomInfo ? ` (${guest.roomInfo})` : "";
    doc.text(`\u2022  ${guest.guestName}${info}`, MARGIN_LEFT + 4, y);
    y += 4;
  }
  y += 3;
  drawHorizontalLine(doc, y);
  y += 6;

  // Per-guest sections
  for (const guest of data.guests) {
    y = checkPageBreak(doc, y, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setFillColor(240, 248, 240);
    doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 8, "F");
    doc.text(guest.guestName, MARGIN_LEFT + 3, y);
    if (guest.roomInfo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(guest.roomInfo, rightX - 2, y, { align: "right" });
    }
    y += 7;

    for (const order of guest.orders) {
      y = checkPageBreak(doc, y, 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`Order ${order.orderNumber}`, MARGIN_LEFT + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(dateStr, rightX, y, { align: "right" });
      y += 4;

      y = drawTableHeader(doc, y);
      for (const item of order.items) {
        y = drawItemRow(doc, y, item);
      }

      if (order.specialInstructions) {
        y = checkPageBreak(doc, y, 6);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Note: ${order.specialInstructions}`, MARGIN_LEFT + 2, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        y += 5;
      }
      y += 2;
    }

    // Per-guest subtotal
    y = checkPageBreak(doc, y, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${guest.guestName} Total:`, rightX - 50, y, { align: "right" });
    doc.text(formatPaise(guest.guestTotal), rightX - 2, y, { align: "right" });
    y += 4;
    drawHorizontalLine(doc, y);
    y += 6;
  }

  // Grand totals
  y = checkPageBreak(doc, y, 35);
  const totalsX = rightX - 2;
  const labelsX = totalsX - 50;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Combined Subtotal:", labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandSubtotal), totalsX, y, { align: "right" });
  y += 5;

  doc.text(`Tax (${data.taxRate}%):`, labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandTax), totalsX, y, { align: "right" });
  y += 5;

  drawHorizontalLine(doc, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Grand Total:", labelsX, y, { align: "right" });
  doc.text(formatPaise(data.grandTotal), totalsX, y, { align: "right" });
  y += 7;

  if (data.equalSplitAmount) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Split equally: ${formatPaise(data.equalSplitAmount)} per person (${data.guests.length} guests)`,
      PAGE_WIDTH / 2,
      y,
      { align: "center" }
    );
    y += 5;
  }

  if (data.paymentMethod) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Method: ${data.paymentMethod}`, labelsX, y, { align: "right" });
    y += 5;
  }

  drawFooter(doc);

  const guestNames = data.guests
    .map((g) => sanitizeFilename(g.guestName))
    .slice(0, 3)
    .join("-");
  const suffix = data.guests.length > 3 ? `-and-${data.guests.length - 3}-more` : "";
  const filename = `Goko-Combined-Bill-${guestNames}${suffix}-${data.billDate.replace(/[\s,]/g, "-")}.pdf`;
  doc.save(filename);
}

// ─── Daily Summary ───────────────────────────────────────────────────────────

export function generateDailySummary(data: DailySummaryData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GOKO HOSTEL \u2014 DAILY FOOD SALES SUMMARY", PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;

  drawHorizontalLine(doc, y);
  y += 6;

  // Date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.date, PAGE_WIDTH / 2, y, { align: "center" });
  y += 10;

  // Key metrics
  const metricsY = y;
  const col1 = MARGIN_LEFT + 10;
  const col2 = PAGE_WIDTH / 2 - 5;
  const col3 = PAGE_WIDTH - MARGIN_RIGHT - 40;

  doc.setFillColor(245, 250, 245);
  doc.roundedRect(MARGIN_LEFT, metricsY - 5, CONTENT_WIDTH, 20, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Total Orders", col1, metricsY);
  doc.text("Total Revenue", col2, metricsY);
  doc.text("Tax Collected", col3, metricsY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(String(data.totalOrders), col1, metricsY + 8);
  doc.text(formatPaise(data.totalRevenue), col2, metricsY + 8);
  doc.text(formatPaise(data.taxCollected), col3, metricsY + 8);
  y = metricsY + 20;

  // Hostel vs Walk-in breakdown
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Breakdown: Hostel vs Walk-in", MARGIN_LEFT, y);
  y += 6;

  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Type", MARGIN_LEFT + 3, y);
  doc.text("Orders", PAGE_WIDTH / 2, y, { align: "center" });
  doc.text("Revenue", PAGE_WIDTH - MARGIN_RIGHT - 3, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Hostel Guests", MARGIN_LEFT + 3, y);
  doc.text(String(data.hostelOrders), PAGE_WIDTH / 2, y, { align: "center" });
  doc.text(formatPaise(data.hostelRevenue), PAGE_WIDTH - MARGIN_RIGHT - 3, y, { align: "right" });
  y += 5;

  doc.text("Walk-in Guests", MARGIN_LEFT + 3, y);
  doc.text(String(data.walkinOrders), PAGE_WIDTH / 2, y, { align: "center" });
  doc.text(formatPaise(data.walkinRevenue), PAGE_WIDTH - MARGIN_RIGHT - 3, y, { align: "right" });
  y += 4;
  drawHorizontalLine(doc, y);
  y += 8;

  // Top selling items
  if (data.topItems.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Top Selling Items", MARGIN_LEFT, y);
    y += 6;

    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 7, "F");
    doc.setFontSize(9);
    doc.text("Item Name", MARGIN_LEFT + 3, y);
    doc.text("Qty Sold", PAGE_WIDTH / 2 + 10, y, { align: "center" });
    doc.text("Revenue", PAGE_WIDTH - MARGIN_RIGHT - 3, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    for (const item of data.topItems) {
      y = checkPageBreak(doc, y, 6);
      doc.text(item.name, MARGIN_LEFT + 3, y);
      doc.text(String(item.quantity), PAGE_WIDTH / 2 + 10, y, { align: "center" });
      doc.text(formatPaise(item.revenue), PAGE_WIDTH - MARGIN_RIGHT - 3, y, { align: "right" });
      y += 5;
    }
    y += 2;
    drawHorizontalLine(doc, y);
    y += 8;
  }

  // Order status breakdown
  const statusLabels: Record<string, string> = {
    placed: "Placed",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    cancelled: "Cancelled",
  };

  const statuses = Object.entries(data.ordersByStatus);
  if (statuses.length > 0) {
    y = checkPageBreak(doc, y, 10 + statuses.length * 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Orders by Status", MARGIN_LEFT, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const [status, count] of statuses) {
      doc.text(statusLabels[status] || status, MARGIN_LEFT + 5, y);
      doc.text(String(count), MARGIN_LEFT + 60, y);
      y += 5;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("This is a computer-generated report", PAGE_WIDTH / 2, PAGE_HEIGHT - 13, { align: "center" });
    if (pageCount > 1) {
      doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 9, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }

  const dateSlug = data.date.replace(/[\s,]/g, "-");
  doc.save(`Goko-Daily-Summary-${dateSlug}.pdf`);
}
