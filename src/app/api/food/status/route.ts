import { NextRequest, NextResponse } from "next/server";
import { getFoodOrderByNumber, getFoodOrderItems } from "@/db/queries";
import { phonesMatch } from "@/lib/phoneUtils";

export async function GET(req: NextRequest) {
  const orderNumber = req.nextUrl.searchParams.get("order") || "";
  const phone = req.nextUrl.searchParams.get("phone") || "";

  if (!orderNumber || !phone) {
    return NextResponse.json(
      { found: false, error: "Missing order number or phone" },
      { status: 400 }
    );
  }

  try {
    const order = await getFoodOrderByNumber(orderNumber);

    if (!order) {
      return NextResponse.json({ found: false });
    }

    if (!phonesMatch(order.guestPhone, phone)) {
      return NextResponse.json({ found: false });
    }

    const items = await getFoodOrderItems(order.id);

    return NextResponse.json({
      found: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        guestName: order.guestName,
        items: items.map((i) => ({
          name: i.itemName,
          price: i.itemPrice,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        specialInstructions: order.specialInstructions,
        createdAt: order.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Order status error:", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch order status" }, { status: 500 });
  }
}
