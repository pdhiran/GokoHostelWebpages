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
  getRecentlyCheckedOutGuests,
  decrementStock,
  updateFoodOrderStatus,
} from "@/db/queries";
import { normalizePhone, phonesMatch } from "@/lib/phoneUtils";
import { isKitchenOpen, parseKitchenHours, formatSlotsForDisplay } from "@/lib/kitchenHours";

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

    // Verify hostel guest: phone must match an active or recently checked-out checkin
    if (guestType === "hostel" && checkinId && guestPhone) {
      const activeCheckins = await getActiveCheckins();
      let checkin = activeCheckins.find((c) => c.id === checkinId);
      if (!checkin || !phonesMatch(checkin.contact, guestPhone)) {
        const graceDaysStr = await getSetting("food_checkout_grace_days");
        const graceDays = Number(graceDaysStr) || 10;
        if (graceDays > 0) {
          const checkedOut = await getRecentlyCheckedOutGuests(graceDays);
          checkin = checkedOut.find((c) => c.id === checkinId);
        }
        if (!checkin || !phonesMatch(checkin.contact, guestPhone)) {
          return NextResponse.json({ error: "Guest verification failed" }, { status: 403 });
        }
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
    const kitchenHoursStr = (await getSetting("food_kitchen_hours")) || "08:00-15:00,18:00-23:30";
    const kitchenStatus = isKitchenOpen(kitchenHoursStr);

    if (!kitchenStatus.open) {
      const slots = parseKitchenHours(kitchenHoursStr);
      return NextResponse.json(
        {
          error: "Kitchen is currently closed",
          message: `Kitchen hours: ${formatSlotsForDisplay(slots)} IST`,
          nextOpen: kitchenStatus.nextOpenAt || slots[0]?.open || "08:00",
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
      trackInventory: boolean;
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
        trackInventory: !!menuItem.trackInventory,
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
    const isGuestOrder = !createdBy || createdBy === "guest";
    const requireApproval = isGuestOrder && (await getSetting("food_confirm_with_guest")) === "true";
    const initialStatus = requireApproval ? "pending_approval" : "placed";

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
        status: initialStatus,
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
          status: initialStatus,
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

    // 8c. Auto-skip to "ready" if all items are inventory-tracked and order is placed (not pending)
    if (initialStatus === "placed" && validatedItems.length > 0 && validatedItems.every((v) => v.trackInventory)) {
      await updateFoodOrderStatus(order.id, "ready");
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
