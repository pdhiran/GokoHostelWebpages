"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Loader2Icon, RefreshCwIcon, XIcon, PlusIcon, MinusIcon, SearchIcon, ChevronDownIcon, ChevronRightIcon, BanknoteIcon, SmartphoneIcon, PrinterIcon } from "lucide-react";
import { isBluetoothSupported, printFoodBill, printCombinedBill, type BillItem } from "@/lib/thermalPrint";
import type { Role } from "./types";

type FoodTab = "active" | "place" | "tabs" | "walkin" | "combined" | "history";

interface OrderItem {
  id: number;
  menuItemId: number;
  itemName: string;
  itemPrice: number;
  quantity: number;
  lineTotal: number;
  status: string;
}

interface Order {
  id: number;
  orderNumber: string;
  guestType: string;
  checkinId: number | null;
  guestName: string;
  guestPhone: string;
  roomInfo: string;
  specialInstructions: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  cancelledReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface Guest {
  id: number;
  name: string;
  contact: string;
  arrivalDate: string;
  stayingDays: string;
  bedInfo: string;
}

interface GuestWithTab {
  checkinId: number;
  name: string;
  contact: string;
  bedInfo: string;
  tabTotal: number;
  orderCount: number;
}

interface MenuItem {
  id: number;
  categoryId: number;
  name: string;
  nameKannada: string;
  description: string;
  price: number;
  priceText: string;
  tags: string;
  isAvailable: number;
}

interface MenuCategory {
  id: number;
  name: string;
  nameKannada: string;
  icon: string;
  displayOrder: number;
}

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

export function AdminFoodOrders({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [tab, setTab] = useState<FoodTab>("active");

  const apiCall = useCallback(async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    const res = await fetch("/api/admin/food-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }, [password, username]);

  const TABS: { id: FoodTab; label: string }[] = [
    { id: "active", label: "Active Orders" },
    { id: "place", label: "Place Order" },
    { id: "tabs", label: "Guest Tabs" },
    { id: "walkin", label: "Walk-in Orders" },
    { id: "combined", label: "Combined Bill" },
    { id: "history", label: "Order History" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-brand-mist bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-brand-green text-white" : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "active" && <ActiveOrders apiCall={apiCall} />}
      {tab === "place" && <PlaceOrder apiCall={apiCall} />}
      {tab === "tabs" && <GuestTabs apiCall={apiCall} />}
      {tab === "walkin" && <WalkinOrders apiCall={apiCall} />}
      {tab === "combined" && <CombinedBill apiCall={apiCall} />}
      {tab === "history" && <OrderHistory apiCall={apiCall} />}
    </div>
  );
}

// ─── Active Orders ───────────────────────────────────────────────────────────

function ActiveOrders({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "listOrders", status: "active" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (orderId: number, status: string, reason?: string) => {
    setBusy(orderId);
    try {
      await apiCall({ action: "updateOrderStatus", orderId, status, cancelledReason: reason });
      await load();
    } finally {
      setBusy(null);
      setCancelId(null);
      setCancelReason("");
    }
  };

  if (loading) return <LoadingState />;

  const statusOrder = ["placed", "preparing", "ready"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Active Orders ({orders.length})</h3>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-green hover:bg-brand-green/[0.06]">
          <RefreshCwIcon className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {orders.length === 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">
          No active orders
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statusOrder.map((s) =>
          orders.filter((o) => o.status === s).map((order) => (
            <div key={order.id} className="rounded-xl border border-brand-mist bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-brand-green">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm font-medium text-brand-green-dark">
                {order.guestName}
                {order.guestType === "walkin" && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Walk-in</span>}
                {order.guestType === "hostel" && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>}
              </p>
              {order.roomInfo && <p className="text-xs text-brand-green-dark/60">{order.roomInfo}</p>}
              <div className="mt-2 space-y-0.5">
                {order.items.filter(i => i.status !== "voided").map((item) => (
                  <p key={item.id} className="text-xs text-brand-green-dark/70">
                    {item.quantity}× {item.itemName}
                  </p>
                ))}
              </div>
              {order.specialInstructions && (
                <p className="mt-1 text-xs italic text-brand-green-dark/50">📝 {order.specialInstructions}</p>
              )}
              <p className="mt-2 text-sm font-semibold text-brand-green-dark">₹{(order.total / 100).toFixed(0)}</p>
              <p className="text-xs text-brand-green-dark/40">
                {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                {" · "}{order.guestType === "hostel" ? "🏨 Hostel" : "🚶 Walk-in"}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {order.status === "placed" && (
                  <ActionBtn label="Start" onClick={() => updateStatus(order.id, "preparing")} busy={busy === order.id} />
                )}
                {order.status === "preparing" && (
                  <ActionBtn label="Ready" onClick={() => updateStatus(order.id, "ready")} busy={busy === order.id} />
                )}
                {order.status === "ready" && (
                  <ActionBtn label="Served" onClick={() => updateStatus(order.id, "served")} busy={busy === order.id} />
                )}
                {cancelId === order.id ? (
                  <div className="flex w-full items-center gap-1 mt-1">
                    <input
                      className="flex-1 rounded border border-brand-mist px-2 py-1 text-xs"
                      placeholder="Reason..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => updateStatus(order.id, "cancelled", cancelReason)}
                      className="rounded bg-red-500 px-2 py-1 text-xs text-white"
                      disabled={busy === order.id}
                    >
                      Confirm
                    </button>
                    <button type="button" onClick={() => setCancelId(null)} className="text-xs text-brand-green-dark/50">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCancelId(order.id)}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Place Order ─────────────────────────────────────────────────────────────

function PlaceOrder({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [guestType, setGuestType] = useState<"hostel" | "walkin">("hostel");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [walkinName, setWalkinName] = useState("");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiCall({ action: "getMenu" });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setMenuItems(data.items || []);
        if (data.categories?.length > 0) setSelectedCategory(data.categories[0].id);
      }
      setLoadingMenu(false);
    })();
  }, [apiCall]);

  useEffect(() => {
    if (guestType === "hostel") {
      (async () => {
        const res = await apiCall({ action: "getActiveGuests" });
        if (res.ok) {
          const data = await res.json();
          setGuests(data.guests || []);
        }
      })();
    }
  }, [guestType, apiCall]);

  const filteredGuests = guests.filter(
    (g) => g.name.toLowerCase().includes(guestSearch.toLowerCase()) || g.contact.includes(guestSearch)
  );

  const categoryItems = menuItems.filter((i) => i.categoryId === selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateCartQty = (menuItemId: number, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.menuItemId !== menuItemId) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? null! : { ...c, quantity: newQty };
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartTax = Math.round(cartTotal * 0.05);
  const cartGrandTotal = cartTotal + cartTax;

  const submit = async () => {
    setError("");
    setSuccessMsg("");
    const name = guestType === "hostel" ? selectedGuest?.name : walkinName;
    if (!name) { setError("Please select/enter a guest"); return; }
    if (cart.length === 0) { setError("Cart is empty"); return; }

    setSubmitting(true);
    try {
      const res = await apiCall({
        action: "placeOrderForGuest",
        guestType,
        checkinId: guestType === "hostel" ? selectedGuest?.id : undefined,
        guestName: name,
        roomInfo: guestType === "hostel" ? selectedGuest?.bedInfo : undefined,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        specialInstructions,
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Order ${data.orderNumber} placed! Total: ₹${(data.total / 100).toFixed(0)}`);
        setCart([]);
        setSpecialInstructions("");
        setSelectedGuest(null);
        setWalkinName("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to place order");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMenu) return <LoadingState />;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-bold text-brand-green-dark">Place Order</h3>

      {/* Guest Type Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setGuestType("hostel"); setSelectedGuest(null); }}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-colors", guestType === "hostel" ? "bg-brand-green text-white" : "border border-brand-mist text-brand-green-dark/70")}
        >
          🏨 Hostel Guest
        </button>
        <button
          type="button"
          onClick={() => { setGuestType("walkin"); setSelectedGuest(null); }}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-colors", guestType === "walkin" ? "bg-brand-green text-white" : "border border-brand-mist text-brand-green-dark/70")}
        >
          🚶 Walk-in
        </button>
      </div>

      {/* Guest Selection */}
      <div className="rounded-xl border border-brand-mist bg-white p-4">
        {guestType === "hostel" ? (
          <div>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-brand-green-dark/40" />
              <input
                className="w-full rounded-lg border border-brand-mist pl-9 pr-3 py-2 text-sm"
                placeholder="Search guest by name or contact..."
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
            </div>
            {selectedGuest ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-green/[0.05] px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-brand-green-dark">{selectedGuest.name}</span>
                  {selectedGuest.bedInfo && <span className="ml-2 text-xs text-brand-green-dark/60">{selectedGuest.bedInfo}</span>}
                </div>
                <button type="button" onClick={() => setSelectedGuest(null)} className="text-xs text-red-500">Change</button>
              </div>
            ) : guestSearch.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-brand-mist">
                {filteredGuests.length === 0 ? (
                  <p className="p-3 text-xs text-brand-green-dark/50">No guests found</p>
                ) : filteredGuests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setSelectedGuest(g); setGuestSearch(""); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-brand-green/[0.04] border-b border-brand-mist last:border-0"
                  >
                    <span className="font-medium">{g.name}</span>
                    {g.bedInfo && <span className="ml-2 text-xs text-brand-green-dark/50">{g.bedInfo}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <input
            className="w-full rounded-lg border border-brand-mist px-3 py-2 text-sm"
            placeholder="Guest name"
            value={walkinName}
            onChange={(e) => setWalkinName(e.target.value)}
          />
        )}
      </div>

      {/* Menu Browser */}
      <div className="rounded-xl border border-brand-mist bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                selectedCategory === cat.id ? "bg-brand-green text-white" : "bg-brand-sand text-brand-green-dark/70 hover:bg-brand-mist"
              )}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-brand-mist p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-green-dark">{item.name}</p>
                <p className="text-xs text-brand-green-dark/60">₹{(item.price / 100).toFixed(0)}</p>
              </div>
              <button
                type="button"
                onClick={() => addToCart(item)}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-md bg-brand-green text-white hover:bg-brand-green/90"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {categoryItems.length === 0 && (
            <p className="col-span-full text-center text-xs text-brand-green-dark/50 py-4">No items in this category</p>
          )}
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-4">
          <h4 className="mb-2 text-sm font-bold text-brand-green-dark">Cart ({cart.length} items)</h4>
          <div className="space-y-2">
            {cart.map((c) => (
              <div key={c.menuItemId} className="flex items-center justify-between">
                <span className="text-sm text-brand-green-dark">{c.name}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateCartQty(c.menuItemId, -1)} className="h-6 w-6 rounded border border-brand-mist flex items-center justify-center">
                    <MinusIcon className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{c.quantity}</span>
                  <button type="button" onClick={() => updateCartQty(c.menuItemId, 1)} className="h-6 w-6 rounded border border-brand-mist flex items-center justify-center">
                    <PlusIcon className="h-3 w-3" />
                  </button>
                  <span className="ml-2 w-16 text-right text-sm text-brand-green-dark/70">₹{((c.price * c.quantity) / 100).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-brand-mist pt-2 text-sm">
            <div className="flex justify-between text-brand-green-dark/70"><span>Subtotal</span><span>₹{(cartTotal / 100).toFixed(0)}</span></div>
            <div className="flex justify-between text-brand-green-dark/70"><span>Tax (5%)</span><span>₹{(cartTax / 100).toFixed(0)}</span></div>
            <div className="flex justify-between font-bold text-brand-green-dark"><span>Total</span><span>₹{(cartGrandTotal / 100).toFixed(0)}</span></div>
          </div>
          <textarea
            className="mt-3 w-full rounded-lg border border-brand-mist px-3 py-2 text-sm"
            placeholder="Special instructions (optional)"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
          />
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          {successMsg && <p className="mt-2 text-xs text-green-600">{successMsg}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-3 w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
          >
            {submitting ? "Placing..." : `Place Order · ₹${(cartGrandTotal / 100).toFixed(0)}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Guest Tabs ──────────────────────────────────────────────────────────────

function GuestTabs({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [guests, setGuests] = useState<GuestWithTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGuest, setExpandedGuest] = useState<number | null>(null);
  const [guestOrders, setGuestOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [btSupported, setBtSupported] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getGuestsWithTabs" });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { load(); }, [load]);

  const expandGuest = async (checkinId: number) => {
    if (expandedGuest === checkinId) { setExpandedGuest(null); return; }
    setExpandedGuest(checkinId);
    setLoadingOrders(true);
    try {
      const res = await apiCall({ action: "getGuestTab", checkinId });
      if (res.ok) {
        const data = await res.json();
        setGuestOrders(data.orders || []);
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  const markPaid = async (orderIds: number[], paymentMethod: string) => {
    setBusy(true);
    try {
      await apiCall({ action: "markOrderPaid", orderIds, paymentMethod });
      await load();
      if (expandedGuest) await expandGuest(expandedGuest);
    } finally {
      setBusy(false);
    }
  };

  const markAllPaid = async (checkinId: number, paymentMethod: string) => {
    const orderIds = guestOrders.map((o) => o.id);
    if (orderIds.length === 0) return;
    await markPaid(orderIds, paymentMethod);
  };

  const handlePrintBill = async (guest: GuestWithTab) => {
    setPrinting(guest.checkinId);
    try {
      const allItems: BillItem[] = guestOrders.flatMap(o =>
        o.items.filter(i => i.status !== "voided").map(i => ({
          name: i.itemName,
          quantity: i.quantity,
          price: i.itemPrice,
          lineTotal: i.lineTotal,
          status: i.status,
        }))
      );
      const subtotal = guestOrders.reduce((s, o) => s + o.subtotal, 0);
      const tax = guestOrders.reduce((s, o) => s + o.tax, 0);
      const total = guestOrders.reduce((s, o) => s + o.total, 0);
      await printFoodBill({
        guestName: guest.name,
        guestPhone: guest.contact,
        roomInfo: guest.bedInfo,
        guestType: "hostel",
        items: allItems,
        subtotal,
        tax,
        total,
        taxRate: 5,
      });
      alert("Bill printed successfully!");
    } catch (err: any) {
      alert(`Print failed: ${err.message || "Unknown error"}`);
    } finally {
      setPrinting(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Guest Tabs ({guests.length})</h3>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-green hover:bg-brand-green/[0.06]">
          <RefreshCwIcon className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {guests.length === 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">
          No unpaid tabs
        </div>
      )}

      <div className="space-y-2">
        {guests.map((g) => (
          <div key={g.checkinId} className="rounded-xl border border-brand-mist bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => expandGuest(g.checkinId)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-sand/50"
            >
              <div>
                <span className="text-sm font-medium text-brand-green-dark">{g.name}</span>
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>
                {g.bedInfo && <span className="ml-2 text-xs text-brand-green-dark/50">{g.bedInfo}</span>}
                <span className="ml-2 text-xs text-brand-green-dark/40">({g.orderCount} orders)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-brand-green">₹{(g.tabTotal / 100).toFixed(0)}</span>
                {expandedGuest === g.checkinId ? <ChevronDownIcon className="h-4 w-4 text-brand-green-dark/40" /> : <ChevronRightIcon className="h-4 w-4 text-brand-green-dark/40" />}
              </div>
            </button>

            {expandedGuest === g.checkinId && (
              <div className="border-t border-brand-mist px-4 py-3">
                {loadingOrders ? (
                  <div className="flex justify-center py-4"><Loader2Icon className="h-5 w-5 animate-spin text-brand-green" /></div>
                ) : (
                  <div className="space-y-2">
                    {guestOrders.map((order) => (
                      <div key={order.id} className="rounded-lg border border-brand-mist p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-brand-green">{order.orderNumber}</span>
                            <span className="ml-2 text-xs text-brand-green-dark/50">{new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
                          </div>
                          <span className="text-sm font-semibold">₹{(order.total / 100).toFixed(0)}</span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {order.items.filter(i => i.status !== "voided").map((item) => (
                            <p key={item.id} className="text-xs text-brand-green-dark/60">{item.quantity}× {item.itemName} — ₹{(item.lineTotal / 100).toFixed(0)}</p>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => markPaid([order.id], "cash")}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-md border border-green-500 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            <BanknoteIcon className="h-3.5 w-3.5" /> Cash
                          </button>
                          <button
                            type="button"
                            onClick={() => markPaid([order.id], "online")}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-md border border-blue-500 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <SmartphoneIcon className="h-3.5 w-3.5" /> Online
                          </button>
                        </div>
                      </div>
                    ))}

                    {guestOrders.length > 1 && (
                      <div className="flex items-center gap-2 border-t border-brand-mist pt-2">
                        <button
                          type="button"
                          onClick={() => markAllPaid(g.checkinId, "cash")}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-md border border-green-500 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          <BanknoteIcon className="h-3.5 w-3.5" /> Pay All - Cash · ₹{(g.tabTotal / 100).toFixed(0)}
                        </button>
                        <button
                          type="button"
                          onClick={() => markAllPaid(g.checkinId, "online")}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                          <SmartphoneIcon className="h-3.5 w-3.5" /> Pay All - Online
                        </button>
                      </div>
                    )}

                    {btSupported && (
                      <button
                        type="button"
                        onClick={() => handlePrintBill(g)}
                        disabled={printing === g.checkinId}
                        className="mt-1 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        {printing === g.checkinId ? "Printing..." : "Print Bill"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Walk-in Orders ─────────────────────────────────────────────────────────

function WalkinOrders({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [btSupported, setBtSupported] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "getWalkinOrders" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (orderId: number, paymentMethod: string) => {
    setBusy(orderId);
    try {
      await apiCall({ action: "markOrderPaid", orderIds: [orderId], paymentMethod });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async (order: Order) => {
    setPrinting(order.id);
    try {
      await printFoodBill({
        billNumber: order.orderNumber,
        guestName: order.guestName,
        guestPhone: order.guestPhone || undefined,
        roomInfo: order.roomInfo || undefined,
        guestType: order.guestType,
        items: order.items.filter(i => i.status !== "voided").map(i => ({
          name: i.itemName,
          quantity: i.quantity,
          price: i.itemPrice,
          lineTotal: i.lineTotal,
          status: i.status,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        taxRate: 5,
      });
      alert("Bill printed successfully!");
    } catch (err: any) {
      alert(`Print failed: ${err.message || "Unknown error"}`);
    } finally {
      setPrinting(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Walk-in Orders ({orders.length})</h3>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-green hover:bg-brand-green/[0.06]">
          <RefreshCwIcon className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {orders.length === 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">
          No unpaid walk-in orders
        </div>
      )}

      <div className="space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl border border-brand-mist bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-green">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
                <span className="text-sm font-medium text-brand-green-dark">{order.guestName}</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Walk-in</span>
              </div>
              <span className="text-sm font-bold text-brand-green-dark">₹{(order.total / 100).toFixed(0)}</span>
            </div>

            <div className="mt-2 space-y-0.5">
              {order.items.filter(i => i.status !== "voided").map((item) => (
                <p key={item.id} className="text-xs text-brand-green-dark/70">
                  {item.quantity}× {item.itemName} — ₹{(item.lineTotal / 100).toFixed(0)}
                </p>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-brand-green-dark/50">
                <span>{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>·</span>
                <PaymentBadge status={order.paymentStatus} />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => markPaid(order.id, "cash")}
                  disabled={busy === order.id}
                  className="flex items-center gap-1 rounded-md border border-green-500 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <BanknoteIcon className="h-3.5 w-3.5" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => markPaid(order.id, "online")}
                  disabled={busy === order.id}
                  className="flex items-center gap-1 rounded-md border border-blue-500 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <SmartphoneIcon className="h-3.5 w-3.5" /> Online
                </button>
                {btSupported && (
                  <button
                    type="button"
                    onClick={() => handlePrint(order)}
                    disabled={printing === order.id}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PrinterIcon className="h-3.5 w-3.5" />
                    {printing === order.id ? "Printing..." : "Print"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Combined Bill ───────────────────────────────────────────────────────────

function CombinedBill({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [guests, setGuests] = useState<GuestWithTab[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ guests: any[]; grandTotal: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [btSupported, setBtSupported] = useState(false);
  const [printingCombined, setPrintingCombined] = useState(false);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  useEffect(() => {
    (async () => {
      const res = await apiCall({ action: "getGuestsWithTabs" });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
      }
      setLoading(false);
    })();
  }, [apiCall]);

  const toggleGuest = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setPreview(null);
  };

  const loadPreview = async () => {
    if (selectedIds.length === 0) return;
    setLoadingPreview(true);
    try {
      const res = await apiCall({ action: "getCombinedBill", checkinIds: selectedIds });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePrintCombined = async () => {
    if (!preview) return;
    setPrintingCombined(true);
    try {
      const guestData = preview.guests.map((g: any) => ({
        name: g.guestName as string,
        total: (g.subtotal ?? 0) as number,
        items: ((g.orders || []) as any[]).flatMap((o: any) =>
          ((o.items || []) as any[]).filter((i: any) => i.status !== "voided").map((i: any) => ({
            name: (i.itemName || i.name || "") as string,
            quantity: (i.quantity || 0) as number,
            price: (i.itemPrice || i.price || 0) as number,
            lineTotal: (i.lineTotal || 0) as number,
          }))
        ),
      }));
      await printCombinedBill(guestData, preview.grandTotal, 5);
      alert("Combined bill printed successfully!");
    } catch (err: any) {
      alert(`Print failed: ${err.message || "Unknown error"}`);
    } finally {
      setPrintingCombined(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-bold text-brand-green-dark">Combined Bill</h3>

      {guests.length === 0 ? (
        <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">No guests with unpaid tabs</div>
      ) : (
        <div className="rounded-xl border border-brand-mist bg-white p-4">
          <p className="mb-2 text-sm text-brand-green-dark/70">Select guests to combine:</p>
          <div className="space-y-1.5">
            {guests.map((g) => (
              <label key={g.checkinId} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-brand-sand/50">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(g.checkinId)}
                  onChange={() => toggleGuest(g.checkinId)}
                  className="h-4 w-4 rounded border-brand-mist text-brand-green"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-brand-green-dark">{g.name}</span>
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>
                  {g.bedInfo && <span className="ml-2 text-xs text-brand-green-dark/50">{g.bedInfo}</span>}
                </div>
                <span className="text-sm font-medium text-brand-green">₹{(g.tabTotal / 100).toFixed(0)}</span>
              </label>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={loadPreview}
              disabled={loadingPreview}
              className="mt-3 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
            >
              {loadingPreview ? "Loading..." : `Preview Combined Bill (${selectedIds.length} guests)`}
            </button>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-brand-mist bg-white p-4">
          <h4 className="mb-3 text-sm font-bold text-brand-green-dark">Bill Preview</h4>
          {preview.guests.map((g: any) => (
            <div key={g.checkinId} className="mb-3 border-b border-brand-mist pb-3 last:mb-0 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-green-dark">
                  {g.guestName}
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>
                </span>
                <span className="text-sm font-bold">₹{(g.subtotal / 100).toFixed(0)}</span>
              </div>
              {g.roomInfo && <p className="text-xs text-brand-green-dark/50">{g.roomInfo}</p>}
              <p className="text-xs text-brand-green-dark/40">{g.orders.length} order(s)</p>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-brand-mist pt-3">
            <span className="text-sm font-bold text-brand-green-dark">Grand Total</span>
            <span className="text-lg font-bold text-brand-green">₹{(preview.grandTotal / 100).toFixed(0)}</span>
          </div>
          {btSupported && (
            <button
              type="button"
              onClick={handlePrintCombined}
              disabled={printingCombined}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
            >
              <PrinterIcon className="h-4 w-4" />
              {printingCombined ? "Printing..." : "Print Combined Bill"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Order History ───────────────────────────────────────────────────────────

function OrderHistory({ apiCall }: { apiCall: (body: any) => Promise<Response> }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [guestTypeFilter, setGuestTypeFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { action: "listOrders", limit: 100 };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (statusFilter) params.status = statusFilter;
      if (guestTypeFilter) params.guestType = guestTypeFilter;
      if (!statusFilter && !dateFrom) params.status = "all_history";

      const res = await apiCall(params);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, dateFrom, dateTo, statusFilter, guestTypeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCleanup = async () => {
    setCleanupBusy(true);
    setCleanupResult("");
    try {
      const res = await apiCall({ action: "cleanupOldOrders" });
      const data = await res.json();
      if (res.ok && data.success) {
        setCleanupResult(`Cleaned ${data.ordersCleanedCount} orders, deleted ${data.itemsDeletedCount} item records.`);
        await load();
      } else {
        setCleanupResult(data.error || "Cleanup failed");
      }
    } catch {
      setCleanupResult("Network error during cleanup");
    } finally {
      setCleanupBusy(false);
      setShowCleanupConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Order History</h3>
        <button
          type="button"
          onClick={() => setShowCleanupConfirm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <XIcon className="h-3.5 w-3.5" />
          Cleanup Old Orders
        </button>
      </div>

      {showCleanupConfirm && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            This will delete item details for orders older than 1 week (checked-out hostel guests and completed walk-in orders). Order summaries will be kept. Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCleanup}
              disabled={cleanupBusy}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cleanupBusy ? "Cleaning..." : "Yes, Cleanup"}
            </button>
            <button
              type="button"
              onClick={() => setShowCleanupConfirm(false)}
              className="rounded-lg border border-brand-mist px-4 py-1.5 text-xs font-medium text-brand-green-dark/70 hover:bg-brand-sand"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cleanupResult && (
        <div className="rounded-xl border border-brand-mist bg-white p-3 text-sm text-brand-green-dark">
          {cleanupResult}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-brand-mist bg-white p-3">
        <div>
          <label className="mb-0.5 block text-xs text-brand-green-dark/60">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded border border-brand-mist px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-brand-green-dark/60">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border border-brand-mist px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-brand-green-dark/60">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-brand-mist px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="placed">Placed</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-brand-green-dark/60">Guest Type</label>
          <select value={guestTypeFilter} onChange={(e) => setGuestTypeFilter(e.target.value)} className="rounded border border-brand-mist px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="hostel">Hostel</option>
            <option value="walkin">Walk-in</option>
          </select>
        </div>
      </div>

      {loading ? <LoadingState /> : (
        <div className="space-y-2">
          {orders.length === 0 && (
            <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">
              No orders found
            </div>
          )}
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-brand-mist bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-sand/50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-brand-green">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                  <span className="text-sm text-brand-green-dark">{order.guestName}</span>
                  {order.guestType === "walkin" && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Walk-in</span>}
                  {order.guestType === "hostel" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>}
                  <span className="text-xs text-brand-green-dark/40">{order.guestType === "hostel" ? "🏨" : "🚶"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-brand-green-dark/50">{new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
                  <span className="text-sm font-semibold text-brand-green-dark">₹{(order.total / 100).toFixed(0)}</span>
                  {expandedOrder === order.id ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </div>
              </button>
              {expandedOrder === order.id && (
                <div className="border-t border-brand-mist px-4 py-3 space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className={cn("text-brand-green-dark/70", item.status === "voided" && "line-through opacity-50")}>
                        {item.quantity}× {item.itemName}
                      </span>
                      <span className={cn(item.status === "voided" && "line-through opacity-50")}>₹{(item.lineTotal / 100).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-brand-mist pt-1 text-xs">
                    <span>Payment: <PaymentBadge status={order.paymentStatus} /></span>
                    <span>By: {order.createdBy}</span>
                  </div>
                  {order.cancelledReason && (
                    <p className="text-xs text-red-500">Cancelled: {order.cancelledReason}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2Icon className="h-6 w-6 animate-spin text-brand-green" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    placed: "bg-yellow-100 text-yellow-700",
    preparing: "bg-blue-100 text-blue-700",
    ready: "bg-green-100 text-green-700",
    served: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-600",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[status] || "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "text-yellow-600",
    on_tab: "text-blue-600",
    paid: "text-green-600",
  };
  return <span className={cn("font-medium", colors[status] || "text-gray-600")}>{status.replace("_", " ")}</span>;
}

function ActionBtn({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md bg-brand-green/10 px-2.5 py-1 text-xs font-medium text-brand-green hover:bg-brand-green/20 disabled:opacity-50"
    >
      {busy ? <Loader2Icon className="h-3 w-3 animate-spin" /> : label}
    </button>
  );
}
