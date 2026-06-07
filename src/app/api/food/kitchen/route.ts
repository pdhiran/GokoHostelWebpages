import { NextRequest, NextResponse } from "next/server";
import {
  getActiveFoodOrders,
  getFoodOrderItems,
  updateFoodOrderStatus,
  toggleMenuItemAvailability,
  getAllMenuItems,
  getActiveMenuCategories,
  addOrderModification,
  updateFoodOrder,
  getSetting,
  setSetting,
  getUserByUsername,
} from "@/db/queries";
import { getDb } from "@/db";
import { foodOrderItems } from "@/db/schema";
import { eq } from "drizzle-orm";

type UserRole = "admin" | "manager" | "staff";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateKitchen(password: string): Promise<UserRole | null> {
  if (!password) return null;

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return "admin";
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return "manager";

  try {
    const allUsers = await import("@/db/queries").then((m) => m.getAllUsers());
    for (const user of allUsers) {
      const computed = await hashPassword(password);
      if (computed === user.passwordHash) {
        return (user.role as UserRole) || "staff";
      }
    }
  } catch {}

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action, ...rest } = body;

    const role = await authenticateKitchen(password);
    if (!role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "listOrders") {
      const orders = await getActiveFoodOrders();
      const allItems = await getAllMenuItems();
      const menuItemTags = new Map(allItems.map((m) => [m.id, m.tags || "[]"]));
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await getFoodOrderItems(order.id);
          return {
            ...order,
            items: items.map((i) => ({
              id: i.id,
              menuItemId: i.menuItemId,
              itemName: i.itemName,
              itemPrice: i.itemPrice,
              quantity: i.quantity,
              lineTotal: i.lineTotal,
              status: i.status,
              tags: menuItemTags.get(i.menuItemId) || "[]",
            })),
          };
        })
      );

      const isBusy = (await getSetting("food_kitchen_busy")) === "true";

      return NextResponse.json({
        success: true,
        data: { orders: ordersWithItems, isBusy },
      });
    }

    if (action === "updateStatus") {
      const { orderId, status } = rest;
      if (!orderId || !status) {
        return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
      }

      const validStatuses = ["placed", "preparing", "ready", "served", "cancelled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      await updateFoodOrderStatus(orderId, status);
      return NextResponse.json({ success: true });
    }

    if (action === "toggleItemAvailability") {
      const { menuItemId, isAvailable } = rest;
      if (menuItemId === undefined || isAvailable === undefined) {
        return NextResponse.json({ error: "Missing menuItemId or isAvailable" }, { status: 400 });
      }

      await toggleMenuItemAvailability(menuItemId, isAvailable ? 1 : 0);
      return NextResponse.json({ success: true });
    }

    if (action === "rejectItem") {
      const { orderId, orderItemId, reason } = rest;
      if (!orderId || !orderItemId) {
        return NextResponse.json({ error: "Missing orderId or orderItemId" }, { status: 400 });
      }

      const db = getDb();

      await db
        .update(foodOrderItems)
        .set({ status: "voided" })
        .where(eq(foodOrderItems.id, orderItemId));

      await addOrderModification({
        orderId,
        action: "item_voided",
        itemId: orderItemId,
        oldValue: "active",
        newValue: "voided",
        reason: reason || "",
        modifiedBy: role,
      });

      const allItems = await getFoodOrderItems(orderId);
      const activeItems = allItems.filter((i) => i.status !== "voided");

      const subtotal = activeItems.reduce((sum, i) => sum + i.lineTotal, 0);
      const taxRateStr = await getSetting("food_tax_rate");
      const taxRate = Number(taxRateStr) || 5;
      const tax = Math.round((subtotal * taxRate) / 100);
      const total = subtotal + tax;

      await updateFoodOrder(orderId, { subtotal, tax, total });

      return NextResponse.json({ success: true, data: { subtotal, tax, total } });
    }

    if (action === "toggleBusy") {
      const { isBusy } = rest;
      await setSetting("food_kitchen_busy", isBusy ? "true" : "false");
      return NextResponse.json({ success: true });
    }

    if (action === "getMenuItems") {
      const items = await getAllMenuItems();
      const categories = await getActiveMenuCategories();
      return NextResponse.json({
        success: true,
        data: {
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            nameKannada: i.nameKannada,
            price: i.price,
            isAvailable: i.isAvailable,
            categoryId: i.categoryId,
            tags: i.tags,
          })),
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
          })),
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Kitchen API error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
