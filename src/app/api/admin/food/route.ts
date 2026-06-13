import { NextRequest, NextResponse } from "next/server";
import {
  getAllMenuCategories, addMenuCategory, updateMenuCategory, deleteMenuCategory,
  getAllMenuItems, addMenuItem, updateMenuItem, deleteMenuItem,
  toggleMenuItemAvailability, getMenuItemsByCategory,
  getSetting, setSetting,
  addStock as addStockQuery, getLowStockItems as getLowStockItemsQuery,
} from "@/db/queries";
import { getUserByUsername } from "@/db/queries";

type UserRole = "admin" | "manager" | "staff";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

async function authenticateUser(password: string, username?: string): Promise<UserRole | null> {
  if (!password) return null;

  if (!username) {
    if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return "admin";
    if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return "manager";
    return null;
  }

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD && username === "admin") return "admin";
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD && username === "manager") return "manager";

  try {
    const user = await getUserByUsername(username);
    if (!user) return null;
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;
    return (user.role as UserRole) || "manager";
  } catch {
    return null;
  }
}

const FOOD_SETTINGS_KEYS = [
  "food_kitchen_whatsapp",
  "food_tax_rate",
  "food_kitchen_hours",
  "food_kitchen_open",
  "food_kitchen_close",
  "food_tab_limit",
  "food_checkout_grace_days",
  "food_cafe_tables",
  "food_confirm_with_guest",
  "food_payment_history_days",
  "food_kannada_kitchen_print",
  "food_kannada_kitchen_display",
  "food_approval_in_kitchen",
  "food_kitchen_busy",
  "food_customer_whatsapp",
  "food_show_out_of_stock",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, username, action, ...params } = body;

    const role = await authenticateUser(password, username);
    if (!role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    switch (action) {
      // --- Categories ---
      case "getCategories": {
        const categories = await getAllMenuCategories();
        const allItems = await getAllMenuItems();
        const countsMap: Record<number, number> = {};
        for (const item of allItems) {
          countsMap[item.categoryId] = (countsMap[item.categoryId] || 0) + 1;
        }
        return NextResponse.json({
          categories: categories.map((c) => ({ ...c, itemCount: countsMap[c.id] || 0 })),
        });
      }

      case "addCategory": {
        const { name, nameKannada, icon, description, displayOrder } = params;
        if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
        await addMenuCategory({
          name: name.trim(),
          nameKannada: nameKannada || "",
          icon: icon || "🍽️",
          description: description || "",
          displayOrder: displayOrder ?? 0,
        });
        return NextResponse.json({ ok: true });
      }

      case "updateCategory": {
        const { id, ...data } = params;
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        await updateMenuCategory(id, data);
        return NextResponse.json({ ok: true });
      }

      case "deleteCategory": {
        const { id } = params;
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        await deleteMenuCategory(id);
        return NextResponse.json({ ok: true });
      }

      // --- Menu Items ---
      case "getMenuItems": {
        const items = await getAllMenuItems();
        const categories = await getAllMenuCategories();
        const catMap: Record<number, string> = {};
        for (const c of categories) catMap[c.id] = c.name;
        return NextResponse.json({
          items: items.map((item) => ({
            ...item,
            categoryName: catMap[item.categoryId] || "Unknown",
          })),
        });
      }

      case "getMenuItemsByCategory": {
        const { categoryId } = params;
        if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
        const items = await getMenuItemsByCategory(categoryId);
        return NextResponse.json({ items });
      }

      case "addMenuItem": {
        const { categoryId, name, nameKannada, description, price, priceText, tags, ingredients, imageUrl, displayOrder, trackInventory, stockQuantity, lowStockThreshold } = params;
        if (!categoryId || !name?.trim()) return NextResponse.json({ error: "categoryId and name are required" }, { status: 400 });
        if (typeof price !== "number" || price < 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
        await addMenuItem({
          categoryId,
          name: name.trim(),
          nameKannada: nameKannada || "",
          description: description || "",
          price,
          priceText: priceText || "",
          tags: typeof tags === "string" ? tags : JSON.stringify(tags || []),
          ingredients: typeof ingredients === "string" ? ingredients : JSON.stringify(ingredients || []),
          imageUrl: imageUrl || "",
          displayOrder: displayOrder ?? 0,
          trackInventory: trackInventory ?? 0,
          stockQuantity: stockQuantity ?? 0,
          lowStockThreshold: lowStockThreshold ?? 5,
        });
        return NextResponse.json({ ok: true });
      }

      case "updateMenuItem": {
        const { id, ...data } = params;
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        if (data.tags && typeof data.tags !== "string") data.tags = JSON.stringify(data.tags);
        if (data.ingredients && typeof data.ingredients !== "string") data.ingredients = JSON.stringify(data.ingredients);
        await updateMenuItem(id, data);
        return NextResponse.json({ ok: true });
      }

      case "deleteMenuItem": {
        const { id } = params;
        if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
        await deleteMenuItem(id);
        return NextResponse.json({ ok: true });
      }

      case "toggleItemAvailability": {
        const { id, isAvailable } = params;
        if (!id || isAvailable === undefined) return NextResponse.json({ error: "id and isAvailable are required" }, { status: 400 });
        await toggleMenuItemAvailability(id, isAvailable ? 1 : 0);
        return NextResponse.json({ ok: true });
      }

      case "bulkToggleAvailability": {
        const { categoryId, isAvailable } = params;
        if (!categoryId || isAvailable === undefined) return NextResponse.json({ error: "categoryId and isAvailable required" }, { status: 400 });
        const items = await getMenuItemsByCategory(categoryId);
        for (const item of items) {
          await toggleMenuItemAvailability(item.id, isAvailable ? 1 : 0);
        }
        return NextResponse.json({ ok: true, updated: items.length });
      }

      // --- Inventory ---
      case "addStock": {
        const { menuItemId, quantity } = params;
        if (!menuItemId || !quantity || quantity < 1) return NextResponse.json({ error: "menuItemId and positive quantity required" }, { status: 400 });
        await addStockQuery(menuItemId, quantity);
        return NextResponse.json({ ok: true });
      }

      case "getLowStockItems": {
        const lowStockItems = await getLowStockItemsQuery();
        return NextResponse.json({ items: lowStockItems });
      }

      // --- Food Settings ---
      case "getFoodSettings": {
        const result: Record<string, string> = {};
        for (const key of FOOD_SETTINGS_KEYS) {
          result[key] = (await getSetting(key)) ?? "";
        }
        return NextResponse.json({ settings: result });
      }

      case "updateFoodSettings": {
        const { settings: settingsData } = params;
        if (!settingsData || typeof settingsData !== "object") {
          return NextResponse.json({ error: "settings object is required" }, { status: 400 });
        }
        for (const [key, value] of Object.entries(settingsData)) {
          if (FOOD_SETTINGS_KEYS.includes(key)) {
            await setSetting(key, String(value));
          }
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Admin food API error:", err);
    const raw = err?.message || "Internal error";
    const userMessage = raw.includes("Failed query") || raw.includes("D1_ERROR")
      ? "Database temporarily unavailable. Please try again."
      : raw;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
