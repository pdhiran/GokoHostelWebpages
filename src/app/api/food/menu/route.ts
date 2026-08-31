import { NextResponse } from "next/server";
import { getActiveMenuCategories, getAvailableMenuItems, getAllMenuItems, getSetting } from "@/db/queries";
import { foodTaxPercent } from "@/lib/foodLookup";

export async function GET() {
  try {
    const [categories, showOos, kitchenHours, kitchenBusy, taxRate, whatsappNumber, customerWhatsapp] =
      await Promise.all([
        getActiveMenuCategories(),
        getSetting("food_show_out_of_stock"),
        getSetting("food_kitchen_hours"),
        getSetting("food_kitchen_busy"),
        getSetting("food_tax_rate"),
        getSetting("food_kitchen_whatsapp"),
        getSetting("food_customer_whatsapp"),
      ]);

    const showOutOfStock = showOos === "true";
    const items = showOutOfStock ? await getAllMenuItems() : await getAvailableMenuItems();

    return NextResponse.json({
      categories,
      items,
      settings: {
        kitchenHours: kitchenHours || "08:00-15:00,18:00-23:30",
        isBusy: kitchenBusy === "true",
        taxRate: foodTaxPercent(taxRate),
        whatsappNumber: whatsappNumber || "",
        customerWhatsappEnabled: customerWhatsapp !== "false",
        showOutOfStock,
      },
    });
  } catch (error: any) {
    console.error("Menu API error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load menu" }, { status: 500 });
  }
}
