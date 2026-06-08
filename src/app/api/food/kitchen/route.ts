import { NextRequest, NextResponse } from "next/server";
import {
  getActiveFoodOrders,
  getFoodOrderItems,
  getOrderModifications,
  updateFoodOrderStatus,
  toggleMenuItemAvailability,
  getAllMenuItems,
  getActiveMenuCategories,
  addOrderModification,
  updateFoodOrder,
  updateFoodOrderItemQuantity,
  deleteFoodOrderItem,
  getSetting,
  setSetting,
  getUserByUsername,
  addStock,
  decrementStock,
  getMenuItemById,
} from "@/db/queries";
import { getDb } from "@/db";
import { foodOrderItems, orderModifications } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

type UserRole = "admin" | "manager" | "staff";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateKitchen(password: string): Promise<{ role: UserRole; displayName: string } | null> {
  if (!password) return null;

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return { role: "admin", displayName: "Admin" };
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return { role: "manager", displayName: "Manager" };

  try {
    const allUsers = await import("@/db/queries").then((m) => m.getAllUsers());
    for (const user of allUsers) {
      const computed = await hashPassword(password);
      if (computed === user.passwordHash) {
        return { role: (user.role as UserRole) || "staff", displayName: user.displayName || user.username };
      }
    }
  } catch {}

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action, ...rest } = body;

    const auth = await authenticateKitchen(password);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, displayName: actorName } = auth;

    if (action === "listOrders") {
      const orders = await getActiveFoodOrders();
      const allItems = await getAllMenuItems();
      const menuItemTags = new Map(allItems.map((m) => [m.id, m.tags || "[]"]));

      const db = getDb();
      const modCounts = await db.select({
        orderId: orderModifications.orderId,
        count: sql<number>`COUNT(*)`,
      }).from(orderModifications).groupBy(orderModifications.orderId);
      const modCountMap = new Map(modCounts.map((r) => [r.orderId, r.count]));

      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await getFoodOrderItems(order.id);
          return {
            ...order,
            hasModifications: (modCountMap.get(order.id) || 0) > 0,
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

      const allItemsBefore = await getFoodOrderItems(orderId);
      const voidedItem = allItemsBefore.find((i) => i.id === orderItemId);

      await db
        .update(foodOrderItems)
        .set({ status: "voided" })
        .where(eq(foodOrderItems.id, orderItemId));

      if (voidedItem) {
        await addStock(voidedItem.menuItemId, voidedItem.quantity);
      }

      await addOrderModification({
        orderId,
        action: "item_voided",
        itemId: orderItemId,
        oldValue: "active",
        newValue: "voided",
        reason: reason || "",
        modifiedBy: actorName,
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

    if (action === "updateItemQuantity") {
      const { orderId, orderItemId, newQuantity } = rest;
      if (!orderId || !orderItemId || newQuantity === undefined) {
        return NextResponse.json({ error: "Missing orderId, orderItemId, or newQuantity" }, { status: 400 });
      }

      const allItems = await getFoodOrderItems(orderId);
      const targetItem = allItems.find((i) => i.id === orderItemId);
      if (!targetItem) {
        return NextResponse.json({ error: "Order item not found" }, { status: 404 });
      }

      const oldQty = targetItem.quantity;
      const qtyDiff = oldQty - (newQuantity > 0 ? newQuantity : 0);

      if (newQuantity <= 0) {
        await deleteFoodOrderItem(orderItemId);
        await addOrderModification({
          orderId,
          action: "item_removed",
          itemId: orderItemId,
          oldValue: String(oldQty),
          newValue: "0",
          reason: "Quantity reduced to zero",
          modifiedBy: actorName,
        });
      } else {
        await updateFoodOrderItemQuantity(orderItemId, newQuantity, targetItem.itemPrice);
        await addOrderModification({
          orderId,
          action: "quantity_changed",
          itemId: orderItemId,
          oldValue: String(oldQty),
          newValue: String(newQuantity),
          reason: "",
          modifiedBy: actorName,
        });
      }

      // Restore or decrement inventory based on quantity change
      if (qtyDiff > 0) {
        await addStock(targetItem.menuItemId, qtyDiff);
      } else if (qtyDiff < 0) {
        await decrementStock(targetItem.menuItemId, Math.abs(qtyDiff));
      }

      const updatedItems = await getFoodOrderItems(orderId);
      const activeItems = updatedItems.filter((i) => i.status !== "voided");
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

    if (action === "getOrderModifications") {
      const { orderId } = rest;
      if (!orderId) {
        return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
      }

      const modifications = await getOrderModifications(orderId);
      const allItems = await getAllMenuItems();
      const itemNameMap = new Map(allItems.map((m) => [m.id, m.name]));

      const db = getDb();
      const orderItemRows = await db.select({ id: foodOrderItems.id, itemName: foodOrderItems.itemName })
        .from(foodOrderItems)
        .where(eq(foodOrderItems.orderId, orderId));
      const orderItemNameMap = new Map(orderItemRows.map((r) => [r.id, r.itemName]));

      const formatted = modifications.map((m) => ({
        action: m.action,
        itemName: m.itemId ? (orderItemNameMap.get(m.itemId) || itemNameMap.get(m.itemId) || `Item #${m.itemId}`) : "",
        oldValue: m.oldValue || "",
        newValue: m.newValue || "",
        modifiedBy: m.modifiedBy,
        createdAt: m.createdAt,
      }));

      return NextResponse.json({ success: true, data: { modifications: formatted } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Kitchen API error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
