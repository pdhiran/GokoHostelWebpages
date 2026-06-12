"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

interface OrderData {
  orderNumber: string;
  status: string;
  guestName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  specialInstructions: string;
  createdAt: string;
}

const STATUS_STEPS = ["pending_approval", "placed", "preparing", "ready", "served"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Confirming",
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};
const STATUS_ICONS: Record<string, string> = {
  pending_approval: "⏳",
  placed: "📋",
  preparing: "👨‍🍳",
  ready: "✅",
  served: "🍽️",
};

function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

function getElapsedTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order") || "";
  const phone = searchParams.get("phone") || "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState("");

  const fetchStatus = useCallback(async () => {
    if (!orderNumber || !phone) {
      setError("Missing order or phone info");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/food/status?order=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`
      );
      const data = await res.json();

      if (data.found) {
        setOrder(data.order);
        setElapsed(getElapsedTime(data.order.createdAt));
        setError("");
      } else {
        setError("Order not found");
      }
    } catch {
      setError("Failed to load order status");
    } finally {
      setLoading(false);
    }
  }, [orderNumber, phone]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => {
      setElapsed(getElapsedTime(order.createdAt));
    }, 30000);
    return () => clearInterval(timer);
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white"
        />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-6">
        <div className="max-w-sm rounded-2xl bg-white/95 p-8 text-center shadow-xl">
          <span className="text-4xl">😕</span>
          <h1 className="mt-4 text-xl font-bold text-gray-800">
            {error || "Order not found"}
          </h1>
          <a
            href="/food-order"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg"
          >
            Place an order
          </a>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-4 pt-8">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">Order #{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-blue-100">{elapsed}</p>
        </div>

        {/* Progress stepper */}
        <div className="mb-6 rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur-sm">
          <div className="relative flex justify-between">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200" />
            <div
              className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
              style={{
                width: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%`,
              }}
            />

            {STATUS_STEPS.map((step, idx) => {
              const isActive = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <motion.div
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                      isActive
                        ? "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md"
                        : "bg-gray-100"
                    }`}
                  >
                    {STATUS_ICONS[step]}
                  </motion.div>
                  <span
                    className={`mt-2 text-[11px] font-medium sm:text-xs ${
                      isActive ? "text-blue-600" : "text-gray-400"
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-sm font-medium text-blue-800">
              {order.status === "pending_approval" && "Waiting for staff to confirm your order"}
              {order.status === "placed" && "Your order has been received"}
              {order.status === "preparing" && "The kitchen is preparing your food"}
              {order.status === "ready" && "Your order is ready for pickup!"}
              {order.status === "served" && "Enjoy your meal!"}
              {order.status === "cancelled" && "This order was cancelled"}
            </p>
          </div>
        </div>

        {/* Order details */}
        <div className="rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Order Details</h3>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-gray-600">
                    {item.name} × {item.quantity}
                  </span>
                </div>
                <span className="font-medium text-gray-800">{formatPrice(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal + (order.discount || 0))}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>{formatPrice(order.tax)}</span>
            </div>
            <div className="mt-1 flex justify-between font-bold text-gray-800">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>

          {order.specialInstructions && (
            <div className="mt-3 rounded-lg bg-gray-50 p-2.5">
              <p className="text-xs text-gray-500">Special instructions</p>
              <p className="text-sm text-gray-700">{order.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="mt-6 text-center">
          <a
            href="/food-order?reorder=1"
            className="inline-block rounded-xl bg-white/20 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            Place another order
          </a>
        </div>
      </div>
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
          <div className="text-white text-lg">Loading order status...</div>
        </div>
      }
    >
      <OrderStatusContent />
    </Suspense>
  );
}
