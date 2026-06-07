"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOutIcon,
  ChefHatIcon,
  BellIcon,
  XIcon,
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  PackageIcon,
  FlameIcon,
  UtensilsCrossedIcon,
  PrinterIcon,
} from "lucide-react";
import { isBluetoothSupported, printOrderTicket } from "@/lib/thermalPrint";

interface OrderItem {
  id: number;
  menuItemId: number;
  itemName: string;
  itemPrice: number;
  quantity: number;
  lineTotal: number;
  status: string;
  tags: string;
}

interface Order {
  id: number;
  orderNumber: string;
  guestType: string;
  guestName: string;
  guestPhone: string;
  roomInfo: string;
  tableNumber: string;
  specialInstructions: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdBy: string;
  createdAt: string;
  items: OrderItem[];
}

interface MenuItem {
  id: number;
  name: string;
  nameKannada: string;
  price: number;
  isAvailable: number;
  categoryId: number;
  tags: string;
}

interface KitchenCategory {
  id: number;
  name: string;
  icon: string;
}

interface KitchenDashboardProps {
  password: string;
  onLogout: () => void;
}

type MobileTab = "new" | "preparing" | "ready";

const TAG_COLORS: Record<string, string> = {
  veg: "bg-green-500/20 text-green-400",
  "non-veg": "bg-red-500/20 text-red-400",
  spicy: "bg-amber-500/20 text-amber-400",
  seafood: "bg-blue-500/20 text-blue-400",
  chicken: "bg-orange-500/20 text-orange-400",
  mutton: "bg-red-700/20 text-red-300",
  egg: "bg-yellow-500/20 text-yellow-400",
  "chef-special": "bg-purple-500/20 text-purple-400",
  "goko-special": "bg-indigo-500/20 text-indigo-400",
};

function parseTags(tagsStr: string): string[] {
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function tagDisplayName(tag: string): string {
  return tag.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const REJECT_REASONS = [
  "Out of stock",
  "Not available today",
  "Kitchen capacity",
  "Other",
];

export function KitchenDashboard({ password, onLogout }: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [kitchenCategories, setKitchenCategories] = useState<KitchenCategory[]>([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("new");
  const [showMenuPanel, setShowMenuPanel] = useState(false);
  const [showDemand, setShowDemand] = useState(false);
  const [newOrderBadge, setNewOrderBadge] = useState(0);

  const [rejectModal, setRejectModal] = useState<{
    orderId: number;
    orderItemId: number;
    itemName: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("Out of stock");
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [btSupported, setBtSupported] = useState(false);

  const fetchingRef = useRef(false);
  const prevPlacedCountRef = useRef(0);
  const lastSoundRef = useRef(0);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const api = useCallback(
    async (action: string, extra: Record<string, any> = {}) => {
      const res = await fetch("/api/food/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action, ...extra }),
      });
      if (res.status === 401) {
        onLogout();
        throw new Error("Unauthorized");
      }
      return res.json();
    },
    [password, onLogout]
  );

  const fetchOrders = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await api("listOrders");
      if (data.success) {
        const incoming: Order[] = data.data.orders;
        setOrders(incoming);
        setIsBusy(data.data.isBusy);

        const placedCount = incoming.filter((o) => o.status === "placed").length;
        if (placedCount > prevPlacedCountRef.current && prevPlacedCountRef.current !== -1) {
          const diff = placedCount - prevPlacedCountRef.current;
          const now = Date.now();
          if (now - lastSoundRef.current > 30_000) {
            try {
              if (!audioRef.current) {
                audioRef.current = new Audio(
                  "data:audio/wav;base64,UklGRlgFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTQFAACAgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgP9/gICAgP9/gICAgICAgICAgICAgICAgICBgYKCg4OEhIWFh4eIiImJi4uMjI2Njo6Pj5CQkJCQkJCPj46OjYyLi4qKiYiHh4aGhYSEg4OCgoGBgIB/f35+fXx8e3t6enl5eHh4eHh4eHh5eXp6e3t8fH19fn5/f4CAgYGCgoODhISFhYaGh4eIiImJioqKiouLi4uLi4uLi4uKioqKiYmIiIeHhoaFhYSEg4OCgoGBgIB/f35+fX18fHt7e3t6enp6enp6ent7e3t8fH19fn5/f4CAgYGCgoODhISFhYaGh4eIiImJioqKiouLi4uLi4uLi4uKioqJiYmIiIeHhoaFhYSEg4OCgoGBgIB/f35+fX18fHt7e3t6enp6enp6ent7e3t8fH19fn5/f4CAgYGCgoODhISFhQA="
                );
              }
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            } catch {}
            lastSoundRef.current = now;
          }
          setNewOrderBadge(diff);
          if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
          badgeTimerRef.current = setTimeout(() => setNewOrderBadge(0), 5000);
        }
        prevPlacedCountRef.current = placedCount;
      }
    } catch (err: any) {
      if (err?.message !== "Unauthorized") {
        console.error("Fetch orders error:", err);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [api]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const data = await api("getMenuItems");
      if (data.success) {
        setMenuItems(data.data.items);
        setKitchenCategories(data.data.categories);
        setSelectedMenuCategory((prev) => {
          if (!prev && data.data.categories.length > 0) {
            return data.data.categories[0].id;
          }
          return prev;
        });
      }
    } catch {}
  }, [api]);

  useEffect(() => {
    prevPlacedCountRef.current = -1;
    fetchOrders();
    fetchMenuItems();
    const interval = setInterval(fetchOrders, 5000);
    return () => {
      clearInterval(interval);
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    };
  }, [fetchOrders, fetchMenuItems]);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const updateStatus = async (orderId: number, status: string) => {
    try {
      await api("updateStatus", { orderId, status });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } catch {}
  };

  const toggleAvailability = async (menuItemId: number, currentlyAvailable: number) => {
    const newAvail = currentlyAvailable === 1 ? 0 : 1;
    try {
      await api("toggleItemAvailability", { menuItemId, isAvailable: newAvail === 1 });
      setMenuItems((prev) =>
        prev.map((m) => (m.id === menuItemId ? { ...m, isAvailable: newAvail } : m))
      );
    } catch {}
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setRejectLoading(true);
    const reason = rejectReason === "Other" ? rejectCustom : rejectReason;
    try {
      await api("rejectItem", {
        orderId: rejectModal.orderId,
        orderItemId: rejectModal.orderItemId,
        reason,
      });
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== rejectModal.orderId) return o;
          return {
            ...o,
            items: o.items.map((i) =>
              i.id === rejectModal.orderItemId ? { ...i, status: "voided" } : i
            ),
          };
        })
      );
      setRejectModal(null);
      setRejectReason("Out of stock");
      setRejectCustom("");
    } catch {
    } finally {
      setRejectLoading(false);
    }
  };

  const toggleBusy = async () => {
    const newBusy = !isBusy;
    try {
      await api("toggleBusy", { isBusy: newBusy });
      setIsBusy(newBusy);
    } catch {}
  };

  const handlePrintTicket = async (order: Order) => {
    try {
      await printOrderTicket({
        orderNumber: order.orderNumber,
        guestName: order.guestName,
        guestType: order.guestType,
        roomInfo: order.roomInfo || undefined,
        items: order.items.filter(i => i.status !== "voided").map(i => ({
          name: i.itemName,
          quantity: i.quantity,
        })),
        specialInstructions: order.specialInstructions || undefined,
        createdAt: order.createdAt,
      });
    } catch (err: any) {
      alert(`Print failed: ${err.message || "Unknown error"}`);
    }
  };

  const placedOrders = useMemo(() => orders.filter((o) => o.status === "placed"), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === "preparing"), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === "ready"), [orders]);

  const demandSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of placedOrders) {
      for (const item of order.items) {
        if (item.status === "voided") continue;
        map.set(item.itemName, (map.get(item.itemName) || 0) + item.quantity);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty }));
  }, [placedOrders]);

  const unavailableItems = useMemo(
    () => menuItems.filter((m) => m.isAvailable === 0),
    [menuItems]
  );

  const categoryMenuItems = useMemo(
    () => selectedMenuCategory ? menuItems.filter((m) => m.categoryId === selectedMenuCategory) : [],
    [menuItems, selectedMenuCategory]
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-700 bg-slate-800/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ChefHatIcon className="h-6 w-6 text-amber-400" />
            <h1 className="text-lg font-bold">Kitchen</h1>
            <AnimatePresence>
              {newOrderBadge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-slate-900"
                >
                  <BellIcon className="h-3 w-3" />
                  {newOrderBadge} new
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBusy}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isBusy
                  ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/50"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {isBusy ? (
                <ToggleRightIcon className="h-4 w-4" />
              ) : (
                <ToggleLeftIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isBusy ? "BUSY MODE ON" : "Busy Mode"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMenuPanel(!showMenuPanel);
                if (!showMenuPanel) fetchMenuItems();
              }}
              className="relative flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
            >
              <PackageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Out of Stock</span>
              {unavailableItems.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                  {unavailableItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-slate-700 p-2 text-slate-400 transition-colors hover:bg-slate-600 hover:text-white"
            >
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="flex border-t border-slate-700 md:hidden">
          {(
            [
              { key: "new", label: "New", count: placedOrders.length, color: "amber" },
              { key: "preparing", label: "Preparing", count: preparingOrders.length, color: "blue" },
              { key: "ready", label: "Ready", count: readyOrders.length, color: "emerald" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMobileTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                mobileTab === tab.key
                  ? `border-b-2 ${
                      tab.color === "amber"
                        ? "border-amber-400 text-amber-400"
                        : tab.color === "blue"
                          ? "border-blue-400 text-blue-400"
                          : "border-emerald-400 text-emerald-400"
                    }`
                  : "border-b-2 border-transparent text-slate-500"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    tab.color === "amber"
                      ? "bg-amber-500/20 text-amber-400"
                      : tab.color === "blue"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Menu Availability Panel */}
      <AnimatePresence>
        {showMenuPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-slate-700 bg-slate-800"
          >
            <div className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">
                  Menu Availability
                  {unavailableItems.length > 0 && (
                    <span className="ml-2 text-red-400">
                      ({unavailableItems.length} Out of Stock)
                    </span>
                  )}
                </h3>
              </div>
              {/* Category selector */}
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {kitchenCategories.map((cat) => {
                  const catUnavail = menuItems.filter(
                    (m) => m.categoryId === cat.id && m.isAvailable === 0
                  ).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedMenuCategory(cat.id)}
                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedMenuCategory === cat.id
                          ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      {catUnavail > 0 && (
                        <span className="ml-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                          {catUnavail}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Items in selected category */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categoryMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      item.isAvailable
                        ? "bg-slate-700/50"
                        : "bg-red-900/20 ring-1 ring-red-500/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.nameKannada && (
                        <p className="truncate text-xs text-slate-400">
                          {item.nameKannada}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAvailability(item.id, item.isAvailable)}
                      className={`ml-3 flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        item.isAvailable
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      }`}
                    >
                      {item.isAvailable ? "Available" : "Out of Stock"}
                    </button>
                  </div>
                ))}
                {categoryMenuItems.length === 0 && (
                  <p className="col-span-full py-4 text-center text-sm text-slate-500">
                    {kitchenCategories.length === 0 ? "No categories found" : "No items in this category"}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aggregate Demand */}
      {placedOrders.length > 0 && (
        <div className="border-b border-slate-700 bg-slate-800/60">
          <button
            type="button"
            onClick={() => setShowDemand(!showDemand)}
            className="flex w-full items-center justify-between px-4 py-2 text-sm"
          >
            <span className="flex items-center gap-2 font-medium text-slate-300">
              <FlameIcon className="h-4 w-4 text-orange-400" />
              Demand Summary
            </span>
            {showDemand ? (
              <ChevronUpIcon className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            )}
          </button>
          <AnimatePresence>
            {showDemand && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {demandSummary.map((d) => (
                    <span
                      key={d.name}
                      className="rounded-full bg-slate-700 px-3 py-1 text-sm"
                    >
                      <span className="font-bold text-amber-400">{d.qty}x</span>{" "}
                      {d.name}
                    </span>
                  ))}
                  {demandSummary.length === 0 && (
                    <span className="text-sm text-slate-500">No pending items</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Order Columns */}
      <div className="p-4">
        {/* Desktop: 3-column grid */}
        <div className="hidden gap-4 md:grid md:grid-cols-3">
          <OrderColumn
            title="New Orders"
            orders={placedOrders}
            color="amber"
            actionLabel="START PREPARING"
            actionColor="bg-emerald-600 hover:bg-emerald-500"
            onAction={(id) => updateStatus(id, "preparing")}
            onRejectItem={(orderId, item) =>
              setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
            }
            onPrintTicket={btSupported ? handlePrintTicket : undefined}
          />
          <OrderColumn
            title="Preparing"
            orders={preparingOrders}
            color="blue"
            actionLabel="MARK READY"
            actionColor="bg-blue-600 hover:bg-blue-500"
            onAction={(id) => updateStatus(id, "ready")}
            onRejectItem={(orderId, item) =>
              setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
            }
          />
          <OrderColumn
            title="Ready for Pickup"
            orders={readyOrders}
            color="emerald"
            actionLabel="MARK SERVED"
            actionColor="bg-slate-600 hover:bg-slate-500"
            onAction={(id) => updateStatus(id, "served")}
            onRejectItem={(orderId, item) =>
              setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
            }
          />
        </div>

        {/* Mobile: Tab content */}
        <div className="md:hidden">
          {mobileTab === "new" && (
            <OrderColumn
              title="New Orders"
              orders={placedOrders}
              color="amber"
              actionLabel="START PREPARING"
              actionColor="bg-emerald-600 hover:bg-emerald-500"
              onAction={(id) => updateStatus(id, "preparing")}
              onRejectItem={(orderId, item) =>
                setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
              }
              onPrintTicket={btSupported ? handlePrintTicket : undefined}
            />
          )}
          {mobileTab === "preparing" && (
            <OrderColumn
              title="Preparing"
              orders={preparingOrders}
              color="blue"
              actionLabel="MARK READY"
              actionColor="bg-blue-600 hover:bg-blue-500"
              onAction={(id) => updateStatus(id, "ready")}
              onRejectItem={(orderId, item) =>
                setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
              }
            />
          )}
          {mobileTab === "ready" && (
            <OrderColumn
              title="Ready for Pickup"
              orders={readyOrders}
              color="emerald"
              actionLabel="MARK SERVED"
              actionColor="bg-slate-600 hover:bg-slate-500"
              onAction={(id) => updateStatus(id, "served")}
              onRejectItem={(orderId, item) =>
                setRejectModal({ orderId, orderItemId: item.id, itemName: item.itemName })
              }
            />
          )}
        </div>

        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <UtensilsCrossedIcon className="mb-4 h-12 w-12" />
            <p className="text-lg font-medium">No active orders</p>
            <p className="text-sm">Orders will appear here automatically</p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <AlertTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Reject Item</h3>
                  <p className="text-sm text-slate-400">{rejectModal.itemName}</p>
                </div>
              </div>

              <div className="space-y-2">
                {REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                      rejectReason === reason
                        ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {rejectReason === "Other" && (
                <input
                  type="text"
                  value={rejectCustom}
                  onChange={(e) => setRejectCustom(e.target.value)}
                  placeholder="Enter reason..."
                  autoFocus
                  className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none focus:border-red-500"
                />
              )}

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="flex-1 rounded-lg bg-slate-700 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={rejectLoading || (rejectReason === "Other" && !rejectCustom.trim())}
                  className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  {rejectLoading ? "Rejecting..." : "Reject Item"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ——— Order Column ——— */

function OrderColumn({
  title,
  orders,
  color,
  actionLabel,
  actionColor,
  onAction,
  onRejectItem,
  onPrintTicket,
}: {
  title: string;
  orders: Order[];
  color: "amber" | "blue" | "emerald";
  actionLabel: string;
  actionColor: string;
  onAction: (orderId: number) => void;
  onRejectItem: (orderId: number, item: OrderItem) => void;
  onPrintTicket?: (order: Order) => Promise<void>;
}) {
  const borderColor =
    color === "amber"
      ? "border-amber-500/40"
      : color === "blue"
        ? "border-blue-500/40"
        : "border-emerald-500/40";

  const headerBg =
    color === "amber"
      ? "bg-amber-500/10 text-amber-400"
      : color === "blue"
        ? "bg-blue-500/10 text-blue-400"
        : "bg-emerald-500/10 text-emerald-400";

  const badgeBg =
    color === "amber"
      ? "bg-amber-500 text-slate-900"
      : color === "blue"
        ? "bg-blue-500 text-white"
        : "bg-emerald-500 text-white";

  return (
    <div className="flex flex-col">
      <div
        className={`mb-3 flex items-center justify-between rounded-lg px-4 py-2 ${headerBg}`}
      >
        <span className="text-sm font-bold">{title}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeBg}`}
        >
          {orders.length}
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              borderColor={borderColor}
              actionLabel={actionLabel}
              actionColor={actionColor}
              onAction={() => onAction(order.id)}
              onRejectItem={(item) => onRejectItem(order.id, item)}
              isReadyColumn={color === "emerald"}
              onPrintTicket={onPrintTicket ? () => onPrintTicket(order) : undefined}
            />
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-600">No orders</p>
        )}
      </div>
    </div>
  );
}

/* ——— Order Card ——— */

function OrderCard({
  order,
  borderColor,
  actionLabel,
  actionColor,
  onAction,
  onRejectItem,
  isReadyColumn,
  onPrintTicket,
}: {
  order: Order;
  borderColor: string;
  actionLabel: string;
  actionColor: string;
  onAction: () => void;
  onRejectItem: (item: OrderItem) => void;
  isReadyColumn: boolean;
  onPrintTicket?: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    await onAction();
    setLoading(false);
  };

  const elapsed = useElapsed(order.createdAt);
  const activeItems = order.items.filter((i) => i.status !== "voided");
  const voidedItems = order.items.filter((i) => i.status === "voided");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border-l-4 bg-slate-800 shadow-lg ${borderColor}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className="text-xl font-bold tracking-tight">
              #{order.orderNumber}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-300">
                {order.guestName}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  order.guestType === "hostel"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-slate-600 text-slate-300"
                }`}
              >
                {order.guestType === "hostel" ? "Hostel" : "Walk-in"}
              </span>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                {order.createdBy === "staff" ? "Staff order" : "Guest order"}
              </span>
            </div>
          </div>
          <TimeBadge minutes={elapsed} />
        </div>

        {/* Room / Table */}
        {(order.roomInfo || order.tableNumber) && (
          <div className="mb-2 text-xs text-slate-400">
            {order.roomInfo && <span>Room: {order.roomInfo}</span>}
            {order.roomInfo && order.tableNumber && <span> · </span>}
            {order.tableNumber && <span>Table: {order.tableNumber}</span>}
          </div>
        )}

        {/* Items */}
        <div className="mb-3 space-y-1">
          {activeItems.map((item) => {
            const itemTags = parseTags(item.tags);
            return (
            <div key={item.id} className="group flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-amber-400">{item.quantity}x</span>
                <span>{item.itemName}</span>
                {itemTags.length > 0 && (
                  <div className="flex gap-1">
                    {itemTags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${TAG_COLORS[tag.toLowerCase()] || "bg-slate-600/30 text-slate-400"}`}
                      >
                        {tagDisplayName(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRejectItem(item)}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                title="Reject item"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            );
          })}
          {voidedItems.length > 0 && (
            <div className="mt-1 border-t border-slate-700 pt-1">
              {voidedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-sm text-slate-600 line-through"
                >
                  <span>{item.quantity}x</span>
                  <span>{item.itemName}</span>
                  <span className="text-[10px] text-red-500/70">REJECTED</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Special instructions */}
        {order.specialInstructions && (
          <div className="mb-3 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
            <span className="mr-1 font-semibold">Note:</span>
            {order.specialInstructions}
          </div>
        )}

        {/* Ready column shows name prominently for callout */}
        {isReadyColumn && (
          <div className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
            <span className="text-lg font-bold text-emerald-400">
              {order.guestName}
            </span>
          </div>
        )}

        {/* Print ticket button */}
        {onPrintTicket && (
          <button
            type="button"
            onClick={async () => {
              setPrintLoading(true);
              try { await onPrintTicket(); } catch {} finally { setPrintLoading(false); }
            }}
            disabled={printLoading}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            {printLoading ? "Printing..." : "Print Ticket"}
          </button>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleAction}
          disabled={loading}
          className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 ${actionColor}`}
          style={{ minHeight: 48 }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Updating...
            </span>
          ) : (
            actionLabel
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ——— Time Badge ——— */

function TimeBadge({ minutes }: { minutes: number }) {
  const label =
    minutes < 1
      ? "Just now"
      : minutes < 60
        ? `${minutes}m`
        : `${Math.floor(minutes / 60)}h${minutes % 60}m`;

  const colorClass =
    minutes < 5
      ? "bg-emerald-500/20 text-emerald-400"
      : minutes < 15
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-red-500/20 text-red-400";

  const shouldPulse = minutes >= 5;

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${colorClass}`}
    >
      <ClockIcon className={`h-3 w-3 ${shouldPulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

/* ——— useElapsed hook ——— */

function useElapsed(createdAt: string): number {
  const [minutes, setMinutes] = useState(() => calcMinutes(createdAt));

  useEffect(() => {
    const id = setInterval(() => setMinutes(calcMinutes(createdAt)), 15_000);
    return () => clearInterval(id);
  }, [createdAt]);

  return minutes;
}

function calcMinutes(iso: string): number {
  const created = new Date(iso);
  if (isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 60_000));
}
