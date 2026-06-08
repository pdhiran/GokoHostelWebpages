import { NextRequest, NextResponse } from "next/server";
import {
  getFoodOrderByIdempotencyKey,
  getSetting,
  getMenuItemById,
  getGuestTabTotal,
  getNextOrderNumber,
  createFoodOrder,
  addFoodOrderItems,
  getActiveCheckins,
  decrementStock,
} from "@/db/queries";
import { normalizePhone, phonesMatch } from "@/lib/phoneUtils";

function getISTTime(): { hours: number; minutes: number } {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return { hours: ist.getHours(), minutes: ist.getMinutes() };
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      idempotencyKey,
      guestType,
      checkinId,
      guestName,
      guestPhone,
      roomInfo,
      tableNumber,
      specialInstructions,
      items,
      createdBy,
    } = body;

    if (!guestName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate quantities are positive integers
    for (const item of items) {
      if (!item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
        return NextResponse.json({ error: "Invalid item quantity" }, { status: 400 });
      }
    }

    // Verify hostel guest: phone must match the checkin's contact
    if (guestType === "hostel" && checkinId && guestPhone) {
      const activeCheckins = await getActiveCheckins();
      const checkin = activeCheckins.find((c) => c.id === checkinId);
      if (!checkin || !phonesMatch(checkin.contact, guestPhone)) {
        return NextResponse.json({ error: "Guest verification failed" }, { status: 403 });
      }
    }

    // 1. Idempotency check
    if (idempotencyKey) {
      const existing = await getFoodOrderByIdempotencyKey(idempotencyKey);
      if (existing) {
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          total: existing.total,
          duplicate: true,
        });
      }
    }

    // 2. Kitchen hours check
    const [openStr, closeStr] = await Promise.all([
      getSetting("food_kitchen_open"),
      getSetting("food_kitchen_close"),
    ]);
    const kitchenOpen = openStr || "07:00";
    const kitchenClose = closeStr || "22:00";
    const { hours, minutes } = getISTTime();
    const currentMinutes = hours * 60 + minutes;
    const openMinutes = timeToMinutes(kitchenOpen);
    const closeMinutes = timeToMinutes(kitchenClose);

    if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
      return NextResponse.json(
        {
          error: "Kitchen is currently closed",
          message: `Kitchen hours are ${kitchenOpen} - ${kitchenClose} IST`,
          nextOpen: kitchenOpen,
        },
        { status: 400 }
      );
    }

    // 2b. Busy mode check
    const busyStr = await getSetting("food_kitchen_busy");
    if (busyStr === "true") {
      return NextResponse.json(
        { error: "Kitchen is currently busy and not accepting new orders. Please try again later." },
        { status: 503 }
      );
    }

    // 3. Validate items
    const validatedItems: Array<{
      menuItemId: number;
      itemName: string;
      itemPrice: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const item of items) {
      const menuItem = await getMenuItemById(item.menuItemId);
      if (!menuItem) {
        return NextResponse.json(
          { error: `Menu item #${item.menuItemId} not found` },
          { status: 400 }
        );
      }
      if (menuItem.isAvailable !== 1) {
        return NextResponse.json(
          { error: `"${menuItem.name}" is currently unavailable` },
          { status: 400 }
        );
      }
      if (menuItem.price <= 0) {
        return NextResponse.json(
          { error: `"${menuItem.name}" has an invalid price` },
          { status: 400 }
        );
      }
      if (menuItem.trackInventory && menuItem.stockQuantity < item.quantity) {
        const left = menuItem.stockQuantity;
        return NextResponse.json(
          { error: left === 0 ? `"${menuItem.name}" is out of stock` : `"${menuItem.name}" only has ${left} left in stock` },
          { status: 400 }
        );
      }
      validatedItems.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        itemPrice: menuItem.price,
        quantity: item.quantity,
        lineTotal: menuItem.price * item.quantity,
      });
    }

    // 4. Calculate totals
    const subtotal = validatedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const taxRateStr = await getSetting("food_tax_rate");
    const taxRate = Number(taxRateStr) || 5;
    const tax = Math.round((subtotal * taxRate) / 100);
    const total = subtotal + tax;

    // 5. Tab limit check for hostel guests
    if (guestType === "hostel" && checkinId) {
      const tabLimitStr = await getSetting("food_tab_limit");
      const tabLimit = Number(tabLimitStr) || 0;
      if (tabLimit > 0) {
        const currentTab = await getGuestTabTotal(checkinId);
        if (currentTab + total > tabLimit) {
          return NextResponse.json(
            {
              error: "Tab limit exceeded",
              message: `Current tab: ₹${(currentTab / 100).toFixed(0)}, this order: ₹${(total / 100).toFixed(0)}, limit: ₹${(tabLimit / 100).toFixed(0)}`,
              currentTab,
              tabLimit,
            },
            { status: 400 }
          );
        }
      }
    }

    // 6-7. Generate order number and create order (with retry on race condition)
    let orderNumber = await getNextOrderNumber();
    let order: any;

    try {
      const result = await createFoodOrder({
        orderNumber,
        idempotencyKey: idempotencyKey || undefined,
        guestType: guestType || "walkin",
        checkinId: checkinId || undefined,
        guestName,
        guestPhone: normalizePhone(guestPhone || ""),
        roomInfo: roomInfo || "",
        tableNumber: tableNumber || "",
        specialInstructions: specialInstructions || "",
        subtotal,
        tax,
        total,
        paymentStatus: guestType === "hostel" && checkinId ? "on_tab" : "pending",
        createdBy: createdBy || "guest",
      });
      order = result[0];
    } catch (err: any) {
      if (err?.message?.includes("UNIQUE") || err?.message?.includes("unique")) {
        orderNumber = await getNextOrderNumber();
        const result = await createFoodOrder({
          orderNumber,
          idempotencyKey: idempotencyKey || undefined,
          guestType: guestType || "walkin",
          checkinId: checkinId || undefined,
          guestName,
          guestPhone: normalizePhone(guestPhone || ""),
          roomInfo: roomInfo || "",
          tableNumber: tableNumber || "",
          specialInstructions: specialInstructions || "",
          subtotal,
          tax,
          total,
          paymentStatus: guestType === "hostel" && checkinId ? "on_tab" : "pending",
          createdBy: createdBy || "guest",
        });
        order = result[0];
      } else {
        throw err;
      }
    }

    // 8. Create order items
    await addFoodOrderItems(
      validatedItems.map((v) => ({
        orderId: order.id,
        menuItemId: v.menuItemId,
        itemName: v.itemName,
        itemPrice: v.itemPrice,
        quantity: v.quantity,
        lineTotal: v.lineTotal,
      }))
    );

    // 8b. Decrement stock for inventory-tracked items
    for (const v of validatedItems) {
      await decrementStock(v.menuItemId, v.quantity);
    }

    // 9. Return success
    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total,
    });
  } catch (error: any) {
    console.error("Food order error:", error?.message || error);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
