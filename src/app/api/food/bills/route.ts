import { NextRequest, NextResponse } from "next/server";
import { getActiveCheckins, getGuestAllFoodOrders, getFoodOrderItems } from "@/db/queries";
import { normalizePhone, phonesMatch } from "@/lib/phoneUtils";
import { getDb } from "@/db/index";
import { foodOrders } from "@/db/schema";
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
    }> = [];

    // 1) Hostel guest orders via active checkins
    const activeCheckins = await getActiveCheckins();
    for (const checkin of activeCheckins) {
      if (!phonesMatch(checkin.contact, normalized)) continue;
      const orders = await getGuestAllFoodOrders(checkin.id);
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
          });
        }
      }
    }

    // 2) Walk-in orders by phone match
    const db = getDb();
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

    return NextResponse.json({ unpaidOrders, paidOrders });
  } catch (error: any) {
    console.error("Bills API error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}
