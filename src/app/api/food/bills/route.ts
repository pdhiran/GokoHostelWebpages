import { NextRequest, NextResponse } from "next/server";
import { getActiveCheckins, getGuestAllFoodOrders, getFoodOrderItems } from "@/db/queries";
import { normalizePhone, phonesMatch } from "@/lib/phoneUtils";
import { getDb } from "@/db/index";
import { foodOrders, checkins } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") || "";

  if (!phone) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  try {
    const orderMap = new Map<number, true>();
    const allOrders: Array<{
      id: number;
      orderNumber: string;
      status: string;
      guestType: string;
      guestName: string;
      roomInfo: string | null;
      subtotal: number;
      tax: number;
      total: number;
      paymentStatus: string;
      paymentMethod: string | null;
      createdAt: string;
      checkinId: number | null;
    }> = [];

    // 1) Hostel guest orders via all checkins (active + checked out)
    const db = getDb();
    const allCheckinRows = await db.select().from(checkins).where(eq(checkins.contact, normalized));
    const activeCheckinsList = await getActiveCheckins();
    const matchedCheckinIds = new Map<number, { id: number; status: string; arrivalDate: string }>();
    for (const c of allCheckinRows) matchedCheckinIds.set(c.id, { id: c.id, status: c.status, arrivalDate: c.arrivalDate });
    for (const c of activeCheckinsList) {
      if (phonesMatch(c.contact, normalized) && !matchedCheckinIds.has(c.id))
        matchedCheckinIds.set(c.id, { id: c.id, status: c.status, arrivalDate: c.arrivalDate });
    }

    // Find latest checkin (active preferred, then most recent by arrival date)
    let latestCheckinId: number | null = null;
    let latestDate = "";
    for (const c of matchedCheckinIds.values()) {
      if (c.status === "active") { latestCheckinId = c.id; break; }
      if (c.arrivalDate > latestDate) { latestDate = c.arrivalDate; latestCheckinId = c.id; }
    }

    for (const checkinId of matchedCheckinIds.keys()) {
      const orders = await getGuestAllFoodOrders(checkinId);
      for (const o of orders) {
        if (!orderMap.has(o.id)) {
          orderMap.set(o.id, true);
          allOrders.push({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            guestType: o.guestType,
            guestName: o.guestName,
            roomInfo: o.roomInfo,
            subtotal: o.subtotal,
            tax: o.tax,
            total: o.total,
            paymentStatus: o.paymentStatus,
            paymentMethod: o.paymentMethod,
            createdAt: o.createdAt,
            checkinId: o.checkinId,
          });
        }
      }
    }

    // 2) Walk-in orders by phone match
    const walkinRows = await db
      .select()
      .from(foodOrders)
      .where(and(eq(foodOrders.guestType, "walkin")))
      .orderBy(desc(foodOrders.createdAt));

    for (const o of walkinRows) {
      if (!phonesMatch(o.guestPhone, normalized)) continue;
      if (orderMap.has(o.id)) continue;
      orderMap.set(o.id, true);
      allOrders.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        guestType: o.guestType,
        guestName: o.guestName,
        roomInfo: o.roomInfo,
        subtotal: o.subtotal,
        tax: o.tax,
        total: o.total,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        checkinId: null,
      });
    }

    // Attach items to each order
    const ordersWithItems = await Promise.all(
      allOrders.map(async (o) => {
        const items = await getFoodOrderItems(o.id);
        return {
          orderNumber: o.orderNumber,
          status: o.status,
          guestType: o.guestType,
          guestName: o.guestName,
          roomInfo: o.roomInfo,
          subtotal: o.subtotal,
          tax: o.tax,
          total: o.total,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
          checkinId: o.checkinId,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.itemName,
            quantity: i.quantity,
            price: i.itemPrice,
            lineTotal: i.lineTotal,
          })),
        };
      })
    );

    const unpaidOrders = ordersWithItems.filter(
      (o) => o.paymentStatus !== "paid" && o.status !== "cancelled"
    );
    const paidOrders = ordersWithItems.filter(
      (o) => o.paymentStatus === "paid"
    );

    return NextResponse.json({ unpaidOrders, paidOrders, latestCheckinId });
  } catch (error: any) {
    console.error("Bills API error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}
