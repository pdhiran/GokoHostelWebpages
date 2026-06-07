"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PrinterIcon, DownloadIcon } from "lucide-react";
import { isBluetoothSupported, printFoodBill } from "@/lib/thermalPrint";
import { generateGuestBill, type GuestBillData, type BillOrder } from "@/components/admin/FoodBillGenerator";

export interface CartItemData {
  menuItemId: number;
  name: string;
  nameKannada: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface GuestInfoData {
  name: string;
  phone: string;
  checkinId: number | null;
  guestType: "hostel" | "walkin";
  roomInfo: string;
}

interface FoodCartProps {
  cart: CartItemData[];
  guestInfo: GuestInfoData;
  taxRate?: number;
  whatsappNumber?: string;
  customerWhatsappEnabled?: boolean;
  onUpdateQuantity: (menuItemId: number, delta: number) => void;
  onRemoveItem: (menuItemId: number) => void;
  onOrderPlaced: (orderNumber: string) => void;
  onBack: () => void;
}

function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function FoodCart({
  cart,
  guestInfo,
  taxRate = 5,
  whatsappNumber = "",
  customerWhatsappEnabled = true,
  onUpdateQuantity,
  onRemoveItem,
  onOrderPlaced,
  onBack,
}: FoodCartProps) {
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [walkinName, setWalkinName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState<{
    orderNumber: string;
    total: number;
    items: Array<{ name: string; quantity: number; price: number; lineTotal: number }>;
    subtotal: number;
    taxAmount: number;
  } | null>(null);
  const [btSupported, setBtSupported] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + taxAmount;

  const handlePlaceOrder = async () => {
    const name = guestInfo.guestType === "hostel" ? guestInfo.name : walkinName.trim();
    if (!name) {
      setError("Please enter your name");
      return;
    }

    setSubmitting(true);
    setError("");

    const idempotencyKey = generateUUID();

    try {
      const res = await fetch("/api/food/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          guestType: guestInfo.guestType,
          checkinId: guestInfo.checkinId,
          guestName: name,
          guestPhone: guestInfo.phone,
          roomInfo: guestInfo.roomInfo,
          specialInstructions,
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
          createdBy: "guest",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "Failed to place order");
        setSubmitting(false);
        return;
      }

      setOrderSuccess({
        orderNumber: data.orderNumber,
        total: data.total,
        items: cart.map(c => ({
          name: c.name,
          quantity: c.quantity,
          price: c.price,
          lineTotal: c.price * c.quantity,
        })),
        subtotal,
        taxAmount,
      });
      onOrderPlaced(data.orderNumber);

      if (whatsappNumber && customerWhatsappEnabled) {
        const msg = buildWhatsAppMessage(name, data.orderNumber, cart, total, specialInstructions, guestInfo.roomInfo);
        const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, "_blank");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="px-4 pb-24"
      >
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Order Placed!</h2>
          <p className="mt-2 text-gray-600">
            Order #{orderSuccess.orderNumber}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {formatPrice(orderSuccess.total)}
          </p>

          <div className="mt-6 space-y-3">
            {btSupported && (
              <button
                type="button"
                onClick={async () => {
                  setPrintingReceipt(true);
                  try {
                    await printFoodBill({
                      billNumber: orderSuccess.orderNumber,
                      guestName: guestInfo.guestType === "hostel" ? guestInfo.name : walkinName || "Guest",
                      guestPhone: guestInfo.phone || undefined,
                      roomInfo: guestInfo.roomInfo || undefined,
                      guestType: guestInfo.guestType,
                      items: orderSuccess.items,
                      subtotal: orderSuccess.subtotal,
                      tax: orderSuccess.taxAmount,
                      total: orderSuccess.total,
                      taxRate,
                    });
                    alert("Receipt printed successfully!");
                  } catch (err: any) {
                    alert(`Print failed: ${err.message || "Unknown error"}`);
                  } finally {
                    setPrintingReceipt(false);
                  }
                }}
                disabled={printingReceipt}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4" />
                {printingReceipt ? "Printing..." : "Print Receipt"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const guestName = guestInfo.guestType === "hostel" ? guestInfo.name : walkinName || "Guest";
                const billOrders: BillOrder[] = [{
                  orderNumber: orderSuccess.orderNumber,
                  createdAt: new Date().toISOString(),
                  items: orderSuccess.items.map(i => ({
                    itemName: i.name,
                    quantity: i.quantity,
                    itemPrice: i.price,
                    lineTotal: i.lineTotal,
                    status: "active",
                  })),
                  subtotal: orderSuccess.subtotal,
                  tax: orderSuccess.taxAmount,
                  total: orderSuccess.total,
                }];
                const billData: GuestBillData = {
                  guestName,
                  guestPhone: guestInfo.phone || "",
                  roomInfo: guestInfo.roomInfo || undefined,
                  orders: billOrders,
                  grandSubtotal: orderSuccess.subtotal,
                  grandTax: orderSuccess.taxAmount,
                  grandTotal: orderSuccess.total,
                  taxRate,
                  billDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                };
                generateGuestBill(billData);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              <DownloadIcon className="h-4 w-4" />
              Download PDF
            </button>
            <a
              href={`/food-order/status?order=${orderSuccess.orderNumber}&phone=${guestInfo.phone}`}
              className="block w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-3 text-center font-semibold text-white shadow-lg transition hover:shadow-xl"
            >
              Track your order
            </a>
            <a
              href="/food-order"
              className="block w-full rounded-xl border border-gray-200 py-3 text-center font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Place another order
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  if (cart.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 pb-24"
      >
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <span className="text-4xl">🛒</span>
          <h2 className="mt-3 text-lg font-semibold text-gray-800">Your cart is empty</h2>
          <p className="mt-1 text-sm text-gray-500">Browse the menu and add some dishes</p>
          <button
            onClick={onBack}
            className="mt-5 rounded-xl bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            Browse menu
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-lg px-4 pb-24"
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-800">Your Order</h2>
      </div>

      {/* Cart Items */}
      <div className="space-y-2">
        <AnimatePresence>
          {cart.map((item) => (
            <motion.div
              key={item.menuItemId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{item.name}</p>
                {item.nameKannada && (
                  <p className="truncate text-xs text-gray-500">{item.nameKannada}</p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">{formatPrice(item.price)} each</p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-1.5 py-0.5">
                <button
                  onClick={() => onUpdateQuantity(item.menuItemId, -1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                >
                  −
                </button>
                <span className="min-w-[16px] text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.menuItemId, 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                >
                  +
                </button>
              </div>

              <span className="w-14 text-right text-sm font-semibold text-gray-800">
                {formatPrice(item.price * item.quantity)}
              </span>

              <button
                onClick={() => onRemoveItem(item.menuItemId)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Totals */}
      <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm text-gray-600">
          <span>Tax ({taxRate}%)</span>
          <span>{formatPrice(taxAmount)}</span>
        </div>
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="flex justify-between text-base font-bold text-gray-800">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      {/* Checkout Form */}
      <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        {guestInfo.guestType === "hostel" ? (
          <div className="mb-3 rounded-lg bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-800">{guestInfo.name}</p>
            {guestInfo.roomInfo && (
              <p className="text-xs text-blue-600">{guestInfo.roomInfo}</p>
            )}
            <p className="text-xs text-blue-500">Charged to room tab</p>
          </div>
        ) : (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Your Name *</label>
            <input
              type="text"
              value={walkinName}
              onChange={(e) => {
                setWalkinName(e.target.value);
                setError("");
              }}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Special Instructions</label>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Any dietary needs or requests…"
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </motion.p>
      )}

      <button
        onClick={handlePlaceOrder}
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl disabled:opacity-50"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Placing order…
          </span>
        ) : (
          `Place Order — ${formatPrice(total)}`
        )}
      </button>
    </motion.div>
  );
}

function buildWhatsAppMessage(
  name: string,
  orderNumber: string,
  cart: CartItemData[],
  total: number,
  instructions: string,
  roomInfo: string
): string {
  let msg = `🍽️ *New Food Order #${orderNumber}*\n\n`;
  msg += `👤 ${name}`;
  if (roomInfo) msg += ` (${roomInfo})`;
  msg += "\n\n";

  msg += "*Items:*\n";
  for (const item of cart) {
    msg += `• ${item.name} x${item.quantity} — ₹${Math.round((item.price * item.quantity) / 100)}\n`;
  }
  msg += `\n*Total: ₹${Math.round(total / 100)}*`;

  if (instructions) {
    msg += `\n\n📝 ${instructions}`;
  }

  return msg;
}
