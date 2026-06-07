import { NextResponse } from "next/server";
import { getActiveMenuCategories, getAvailableMenuItems, getSetting } from "@/db/queries";

export async function GET() {
  try {
    const [categories, items, kitchenOpen, kitchenClose, kitchenBusy, taxRate, whatsappNumber] =
      await Promise.all([
        getActiveMenuCategories(),
        getAvailableMenuItems(),
        getSetting("food_kitchen_open"),
        getSetting("food_kitchen_close"),
        getSetting("food_kitchen_busy"),
        getSetting("food_tax_rate"),
        getSetting("food_kitchen_whatsapp"),
      ]);

    return NextResponse.json({
      categories,
      items,
      settings: {
        kitchenOpen: kitchenOpen || "07:00",
        kitchenClose: kitchenClose || "22:00",
        isBusy: kitchenBusy === "true",
        taxRate: Number(taxRate) || 5,
        whatsappNumber: whatsappNumber || "",
      },
    });
  } catch (error: any) {
    console.error("Menu API error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load menu" }, { status: 500 });
  }
}
