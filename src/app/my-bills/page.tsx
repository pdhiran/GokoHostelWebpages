"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface BillItem {
  menuItemId: number;
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

interface BillOrder {
  orderNumber: string;
  status: string;
  guestType: string;
  guestName: string;
  roomInfo: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  createdAt: string;
  items: BillItem[];
}

function formatPhone(digits: string): string {
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + " " + digits.slice(5);
}

function stripNonDigits(val: string): string {
  return val.replace(/\D/g, "").slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const fmt = (dt: Date) => dt.toISOString().split("T")[0];
  if (fmt(d) === fmt(now)) return "Today";
  if (fmt(d) === fmt(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export default function MyBillsPage() {
  const [phone, setPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gokoFoodPhone") || "";
    }
    return "";
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unpaidOrders, setUnpaidOrders] = useState<BillOrder[]>([]);
  const [paidOrders, setPaidOrders] = useState<BillOrder[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const fetchBills = useCallback(async (phoneDigits: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/food/bills?phone=${encodeURIComponent(phoneDigits)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUnpaidOrders(data.unpaidOrders || []);
      setPaidOrders(data.paidOrders || []);
      setSubmitted(true);
    } catch {
      setError("Unable to load bills. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = stripNonDigits(phone);
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit number");
      return;
    }
    localStorage.setItem("gokoFoodPhone", digits);
    fetchBills(digits);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = stripNonDigits(e.target.value);
    setPhone(raw);
    setError("");
  };

  const toggleOrder = (orderNumber: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  };

  const handleChangeNumber = () => {
    setPhone("");
    setSubmitted(false);
    setUnpaidOrders([]);
    setPaidOrders([]);
    setError("");
    localStorage.removeItem("gokoFoodPhone");
  };

  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400">
      <div className="mx-auto max-w-lg px-4 pb-10 pt-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <span className="text-2xl">🧾</span>
          </div>
          <h1 className="text-2xl font-bold text-white">My Bills</h1>
          <p className="mt-1 text-sm text-blue-100">View your food orders & bills</p>
        </div>

        {/* Phone entry */}
        {!submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur-sm"
          >
            <h2 className="mb-1 text-lg font-semibold text-gray-800">Enter your phone number</h2>
            <p className="mb-5 text-sm text-gray-500">We&apos;ll look up your bills</p>

            <form onSubmit={handleSubmit}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="98765 43210"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-lg font-medium tracking-wide text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || stripNonDigits(phone).length < 10}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading…
                  </span>
                ) : (
                  "Continue"
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/food-order"
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                ← Back to menu
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Phone bar + change */}
            <div className="mb-4 flex items-center justify-between rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
              <span className="text-sm font-medium text-white">
                +91 {formatPhone(phone)}
              </span>
              <button
                onClick={handleChangeNumber}
                className="text-sm font-medium text-blue-100 hover:text-white"
              >
                Change
              </button>
            </div>

            {/* Unpaid Bills */}
            {unpaidOrders.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-lg font-bold text-white">Unpaid Bills</h2>
                  <span className="rounded-full bg-amber-400/90 px-3 py-1 text-sm font-bold text-amber-900">
                    ₹{Math.round(unpaidTotal / 100)}
                  </span>
                </div>
                <div className="space-y-3">
                  {unpaidOrders.map((order) => (
                    <OrderCard
                      key={order.orderNumber}
                      order={order}
                      variant="unpaid"
                      expanded={expandedOrders.has(order.orderNumber)}
                      onToggle={() => toggleOrder(order.orderNumber)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Paid Bills */}
            {paidOrders.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 px-1">
                  <h2 className="text-lg font-bold text-white/80">Past Bills</h2>
                </div>
                <div className="space-y-3">
                  {paidOrders.map((order) => (
                    <OrderCard
                      key={order.orderNumber}
                      order={order}
                      variant="paid"
                      expanded={expandedOrders.has(order.orderNumber)}
                      onToggle={() => toggleOrder(order.orderNumber)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No orders */}
            {unpaidOrders.length === 0 && paidOrders.length === 0 && (
              <div className="rounded-2xl bg-white/95 p-8 text-center shadow-xl backdrop-blur-sm">
                <span className="text-4xl">📭</span>
                <p className="mt-3 text-gray-600">No bills found for this number</p>
              </div>
            )}

            {/* Back to menu */}
            <div className="mt-6 text-center">
              <Link
                href="/food-order"
                className="text-sm font-medium text-blue-100 hover:text-white"
              >
                ← Back to menu
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  variant,
  expanded,
  onToggle,
}: {
  order: BillOrder;
  variant: "unpaid" | "paid";
  expanded: boolean;
  onToggle: () => void;
}) {
  const accentBorder = variant === "unpaid" ? "border-l-amber-400" : "border-l-green-400";
  const badgeStyle =
    variant === "unpaid"
      ? "bg-amber-100 text-amber-700"
      : "bg-green-100 text-green-700";
  const badgeLabel =
    variant === "paid"
      ? "Paid"
      : order.paymentStatus === "on_tab"
        ? "On Tab"
        : "Pending";

  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-xl border-l-4 bg-white shadow-sm ${accentBorder} ${variant === "paid" ? "opacity-80" : ""}`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-gray-700">
              #{order.orderNumber}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle}`}>
              {badgeLabel}
            </span>
            {variant === "unpaid" && order.status !== "served" && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {STATUS_LABELS[order.status] || order.status}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            ₹{Math.round(order.total / 100)}
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <div className="space-y-1.5">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="text-gray-500">₹{Math.round(item.lineTotal / 100)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-dashed border-gray-200 pt-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Subtotal</span>
                  <span>₹{Math.round(order.subtotal / 100)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Tax</span>
                    <span>₹{Math.round(order.tax / 100)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between text-sm font-semibold text-gray-800">
                  <span>Total</span>
                  <span>₹{Math.round(order.total / 100)}</span>
                </div>
              </div>
              {variant === "paid" && order.paymentMethod && (
                <p className="mt-2 text-xs text-gray-400">
                  Paid via {order.paymentMethod}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
