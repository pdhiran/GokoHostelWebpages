import { NextResponse } from "next/server";
import { getActiveMenuCategories, getAvailableMenuItems, getAllMenuItems, getSetting } from "@/db/queries";

export async function GET() {
  try {
    const [categories, showOos, kitchenOpen, kitchenClose, kitchenBusy, taxRate, whatsappNumber, customerWhatsapp] =
      await Promise.all([
        getActiveMenuCategories(),
        getSetting("food_show_out_of_stock"),
        getSetting("food_kitchen_open"),
        getSetting("food_kitchen_close"),
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
        kitchenOpen: kitchenOpen || "07:00",
        kitchenClose: kitchenClose || "22:00",
        isBusy: kitchenBusy === "true",
        taxRate: Number(taxRate) || 5,
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
