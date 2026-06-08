"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Loader2Icon, RefreshCwIcon, XIcon, PlusIcon, MinusIcon, SearchIcon, ChevronDownIcon, ChevronRightIcon, BanknoteIcon, SmartphoneIcon, PrinterIcon, DownloadIcon, HistoryIcon } from "lucide-react";
import { isBluetoothSupported, printFoodBill, printCombinedBill, type BillItem } from "@/lib/thermalPrint";
import { generateGuestBill, generateCombinedBill, type CombinedBillData, type BillOrder } from "@/components/admin/FoodBillGenerator";
import { KitchenDashboard } from "@/components/kitchen/KitchenDashboard";
import type { Role } from "./types";

type FoodTab = "active" | "place" | "summary" | "combined" | "history";

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
  paidBy: string;
  cancelledReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  hasModifications?: boolean;
}

interface OrderModification {
  action: string;
  itemName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  createdAt: string;
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

interface PrefillGuest {
  guestType: "hostel" | "walkin";
  checkinId?: number;
  guestName: string;
  guestPhone?: string;
  roomInfo?: string;
}

export function AdminFoodOrders({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [tab, setTab] = useState<FoodTab>("active");
  const [prefillGuest, setPrefillGuest] = useState<PrefillGuest | null>(null);

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
    { id: "summary", label: "Order Summary" },
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

      {tab === "active" && (
        <div className="-mx-4 -mb-4 sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8">
          <KitchenDashboard password={password} onLogout={() => {}} />
        </div>
      )}
      {tab === "place" && <PlaceOrder apiCall={apiCall} prefillGuest={prefillGuest} onPrefillConsumed={() => setPrefillGuest(null)} />}
      {tab === "summary" && <OrderSummary apiCall={apiCall} onOrderMore={(guest) => { setPrefillGuest(guest); setTab("place"); }} />}
      {tab === "combined" && <CombinedBill apiCall={apiCall} />}
      {tab === "history" && <OrderHistory apiCall={apiCall} />}
    </div>
  );
}

// ─── Place Order ─────────────────────────────────────────────────────────────

function PlaceOrder({ apiCall, prefillGuest, onPrefillConsumed }: { apiCall: (body: any) => Promise<Response>; prefillGuest: PrefillGuest | null; onPrefillConsumed: () => void }) {
  const [guestType, setGuestType] = useState<"hostel" | "walkin">(prefillGuest?.guestType || "hostel");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [walkinName, setWalkinName] = useState(prefillGuest?.guestType === "walkin" ? prefillGuest.guestName : "");
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
          if (prefillGuest?.guestType === "hostel" && prefillGuest.checkinId) {
            const match = (data.guests as Guest[]).find((g) => g.id === prefillGuest.checkinId);
            if (match) setSelectedGuest(match);
            onPrefillConsumed();
          }
        }
      })();
    }
  }, [guestType, apiCall]);

  useEffect(() => {
    if (prefillGuest?.guestType === "walkin") {
      onPrefillConsumed();
    }
  }, []);

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
          {categoryItems.map((item) => {
            const cartItem = cart.find((c) => c.menuItemId === item.id);
            const qty = cartItem?.quantity || 0;
            return (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-brand-mist p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-green-dark">{item.name}</p>
                <p className="text-xs text-brand-green-dark/60">₹{(item.price / 100).toFixed(0)}</p>
              </div>
              {qty > 0 ? (
                <div className="ml-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.id, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-brand-mist text-brand-green-dark hover:bg-gray-100"
                  >−</button>
                  <span className="w-7 text-center text-sm font-semibold text-brand-green-dark">{qty}</span>
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green text-white hover:bg-brand-green/90"
                  >+</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  className="ml-2 flex h-8 w-8 items-center justify-center rounded-md bg-brand-green text-white hover:bg-brand-green/90"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            );
          })}
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

// ─── Order Summary (merged Guest Tabs + Walk-in Orders) ─────────────────────

type SummaryFilter = "all" | "hostel" | "walkin";

interface SummaryGroup {
  key: string;
  guestName: string;
  guestType: "hostel" | "walkin";
  contactInfo: string;
  roomInfo: string;
  orders: Order[];
  totalAmount: number;
  totalSubtotal: number;
  totalTax: number;
  orderCount: number;
  latestOrderTime: string;
  earliestOrderTime: string;
}

function OrderSummary({ apiCall, onOrderMore }: { apiCall: (body: any) => Promise<Response>; onOrderMore: (guest: PrefillGuest) => void }) {
  const [hostelGuests, setHostelGuests] = useState<GuestWithTab[]>([]);
  const [walkinOrders, setWalkinOrders] = useState<Order[]>([]);
  const [hostelOrdersMap, setHostelOrdersMap] = useState<Record<number, Order[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SummaryFilter>("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState(false);
  const [printingGroup, setPrintingGroup] = useState<string | null>(null);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hostelRes, walkinRes] = await Promise.all([
        apiCall({ action: "getGuestsWithTabs" }),
        apiCall({ action: "getWalkinOrders" }),
      ]);
      if (hostelRes.ok) {
        const data = await hostelRes.json();
        setHostelGuests(data.guests || []);
        setHostelOrdersMap({});
      }
      if (walkinRes.ok) {
        const data = await walkinRes.json();
        setWalkinOrders(data.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { load(); }, [load]);

  const groups: SummaryGroup[] = useMemo(() => {
    const result: SummaryGroup[] = [];

    for (const g of hostelGuests) {
      const cachedOrders = hostelOrdersMap[g.checkinId] || [];
      const hostelLatest = cachedOrders.length > 0
        ? cachedOrders.reduce((max, o) => o.createdAt > max ? o.createdAt : max, "")
        : "";
      const hostelEarliest = cachedOrders.length > 0
        ? cachedOrders.reduce((min, o) => !min || o.createdAt < min ? o.createdAt : min, "")
        : "";
      result.push({
        key: `hostel_${g.checkinId}`,
        guestName: g.name,
        guestType: "hostel",
        contactInfo: g.contact,
        roomInfo: g.bedInfo,
        orders: cachedOrders,
        totalAmount: g.tabTotal,
        totalSubtotal: g.tabTotal,
        totalTax: 0,
        orderCount: g.orderCount,
        latestOrderTime: hostelLatest,
        earliestOrderTime: hostelEarliest,
      });
    }

    const walkinMap = new Map<string, Order[]>();
    for (const order of walkinOrders) {
      const key = order.guestPhone || `_no_phone_${order.id}`;
      if (!walkinMap.has(key)) walkinMap.set(key, []);
      walkinMap.get(key)!.push(order);
    }
    for (const [phone, groupOrders] of walkinMap) {
      const latest = groupOrders.reduce((max, o) => o.createdAt > max ? o.createdAt : max, "");
      const earliest = groupOrders.reduce((min, o) => !min || o.createdAt < min ? o.createdAt : min, "");
      result.push({
        key: `walkin_${phone}`,
        guestName: groupOrders[0].guestName,
        guestType: "walkin",
        contactInfo: phone.startsWith("_no_phone_") ? "" : phone,
        roomInfo: "",
        orders: groupOrders,
        totalAmount: groupOrders.reduce((s, o) => s + o.total, 0),
        totalSubtotal: groupOrders.reduce((s, o) => s + o.subtotal, 0),
        totalTax: groupOrders.reduce((s, o) => s + o.tax, 0),
        orderCount: groupOrders.length,
        latestOrderTime: latest,
        earliestOrderTime: earliest,
      });
    }

    result.sort((a, b) => {
      const aTime = a.latestOrderTime || "";
      const bTime = b.latestOrderTime || "";
      if (bTime && aTime) return bTime.localeCompare(aTime);
      if (bTime) return 1;
      if (aTime) return -1;
      return 0;
    });

    return result;
  }, [hostelGuests, walkinOrders, hostelOrdersMap]);

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter((g) => g.guestType === filter);
  }, [groups, filter]);

  const getGroupOrders = useCallback((group: SummaryGroup): Order[] => {
    if (group.guestType === "walkin") return group.orders;
    const checkinId = parseInt(group.key.replace("hostel_", ""), 10);
    return hostelOrdersMap[checkinId] || [];
  }, [hostelOrdersMap]);

  const selectedGroup = selectedGroupKey ? groups.find((g) => g.key === selectedGroupKey) || null : null;
  const selectedGroupOrders = selectedGroup ? getGroupOrders(selectedGroup) : [];

  const selectGroup = async (group: SummaryGroup) => {
    setSelectedGroupKey(group.key);

    if (group.guestType === "hostel" && !hostelOrdersMap[parseInt(group.key.replace("hostel_", ""), 10)]) {
      const checkinId = parseInt(group.key.replace("hostel_", ""), 10);
      setLoadingOrders(group.key);
      try {
        const res = await apiCall({ action: "getGuestTab", checkinId });
        if (res.ok) {
          const data = await res.json();
          setHostelOrdersMap((prev) => ({ ...prev, [checkinId]: data.orders || [] }));
        }
      } finally {
        setLoadingOrders(null);
      }
    }
  };

  const markGroupPaid = async (group: SummaryGroup, paymentMethod: string) => {
    const orders = getGroupOrders(group);
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return;
    setBusy(group.key);
    try {
      const res = await apiCall({ action: "markOrderPaid", orderIds, paymentMethod });
      if (res.ok) {
        await load();
        setSelectedGroupKey(null);
      }
    } finally {
      setBusy(null);
    }
  };

  const handlePrintGroup = async (group: SummaryGroup) => {
    const orders = getGroupOrders(group);
    if (orders.length === 0) return;
    setPrintingGroup(group.key);
    try {
      const allItems: BillItem[] = orders.flatMap(o =>
        o.items.filter(i => i.status !== "voided").map(i => ({
          name: i.itemName,
          quantity: i.quantity,
          price: i.itemPrice,
          lineTotal: i.lineTotal,
          status: i.status,
        }))
      );
      const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
      const tax = orders.reduce((s, o) => s + o.tax, 0);
      const total = orders.reduce((s, o) => s + o.total, 0);
      await printFoodBill({
        guestName: group.guestName,
        guestPhone: group.contactInfo || undefined,
        roomInfo: group.roomInfo || undefined,
        guestType: group.guestType === "hostel" ? "hostel" : "walkin",
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
      setPrintingGroup(null);
    }
  };

  const handlePdfGroup = (group: SummaryGroup) => {
    const orders = getGroupOrders(group);
    if (orders.length === 0) return;
    const billOrders: BillOrder[] = orders.map(o => ({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      items: o.items.filter(i => i.status !== "voided").map(i => ({
        itemName: i.itemName,
        quantity: i.quantity,
        itemPrice: i.itemPrice,
        lineTotal: i.lineTotal,
        status: i.status,
      })),
      subtotal: o.subtotal,
      tax: o.tax,
      total: o.total,
      specialInstructions: o.specialInstructions || undefined,
    }));
    generateGuestBill({
      guestName: group.guestName,
      guestPhone: group.contactInfo || "",
      roomInfo: group.roomInfo || undefined,
      orders: billOrders,
      grandSubtotal: orders.reduce((s, o) => s + o.subtotal, 0),
      grandTax: orders.reduce((s, o) => s + o.tax, 0),
      grandTotal: orders.reduce((s, o) => s + o.total, 0),
      taxRate: 5,
      billDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    });
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-brand-green-dark">Order Summary ({filteredGroups.length})</h3>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-green hover:bg-brand-green/[0.06]">
          <RefreshCwIcon className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filter Toggle */}
      <div className="flex gap-1 rounded-lg border border-brand-mist bg-white p-1">
        {([
          { id: "all" as SummaryFilter, label: "All" },
          { id: "hostel" as SummaryFilter, label: "Goko Guest" },
          { id: "walkin" as SummaryFilter, label: "Walk-in" },
        ]).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id ? "bg-brand-green text-white" : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-8 text-center text-sm text-brand-green-dark/50">
          No unpaid orders
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredGroups.map((group) => {
          const timeSince = group.earliestOrderTime ? formatTimeSince(group.earliestOrderTime) : "";
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => selectGroup(group)}
              className={cn(
                "rounded-xl border border-brand-mist bg-white p-3 text-left transition-shadow hover:shadow-md",
                group.guestType === "hostel" ? "border-l-[3px] border-l-green-400" : "border-l-[3px] border-l-gray-300"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="min-w-0 truncate text-sm font-bold text-brand-green-dark">{group.guestName}</span>
                {group.guestType === "hostel" ? (
                  <span className="flex-shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Goko</span>
                ) : (
                  <span className="flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">Walk-in</span>
                )}
              </div>
              {(group.roomInfo || group.contactInfo) && (
                <p className="mt-0.5 truncate text-xs text-brand-green-dark/50">
                  {group.roomInfo || group.contactInfo}
                </p>
              )}
              <p className="mt-2 text-lg font-bold text-brand-green">₹{(group.totalAmount / 100).toFixed(0)}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-brand-green-dark/50">
                <span>{group.orderCount} order{group.orderCount !== 1 ? "s" : ""}</span>
                {timeSince && <span className="text-brand-green-dark/40">{timeSince}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Slide-over Panel */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedGroupKey(null)} />
          <div className="relative flex w-full max-w-md flex-col bg-white shadow-xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-brand-mist px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="min-w-0 truncate text-base font-bold text-brand-green-dark">{selectedGroup.guestName}</h3>
                  {selectedGroup.guestType === "hostel" ? (
                    <span className="flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>
                  ) : (
                    <span className="flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Walk-in</span>
                  )}
                </div>
                {(selectedGroup.roomInfo || selectedGroup.contactInfo) && (
                  <p className="text-xs text-brand-green-dark/50">{[selectedGroup.roomInfo, selectedGroup.contactInfo].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <button type="button" onClick={() => setSelectedGroupKey(null)} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-brand-sand">
                <XIcon className="h-5 w-5 text-brand-green-dark/60" />
              </button>
            </div>

            {/* Total bar */}
            <div className="flex items-center justify-between bg-brand-sand/30 px-4 py-2.5">
              <span className="text-sm text-brand-green-dark/70">{selectedGroup.orderCount} order{selectedGroup.orderCount !== 1 ? "s" : ""}</span>
              <span className="text-xl font-bold text-brand-green">₹{(selectedGroup.totalAmount / 100).toFixed(0)}</span>
            </div>

            {/* Orders list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingOrders === selectedGroup.key ? (
                <div className="flex justify-center py-8"><Loader2Icon className="h-5 w-5 animate-spin text-brand-green" /></div>
              ) : (
                <>
                  {selectedGroupOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-brand-mist p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-green">{order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <span className="text-xs text-brand-green-dark/50">
                          {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {order.items.filter((i) => i.status !== "voided").map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs text-brand-green-dark/60">
                            <span>{item.quantity}× {item.itemName}</span>
                            <span>₹{(item.lineTotal / 100).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 text-right text-sm font-semibold text-brand-green-dark">₹{(order.total / 100).toFixed(0)}</div>
                    </div>
                  ))}
                  {selectedGroupOrders.length === 0 && loadingOrders !== selectedGroup.key && (
                    <p className="text-xs text-brand-green-dark/50 text-center py-4">No orders loaded yet</p>
                  )}
                </>
              )}
            </div>

            {/* Footer action buttons */}
            {selectedGroupOrders.length > 0 && (
              <div className="border-t border-brand-mist p-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => markGroupPaid(selectedGroup, "cash")}
                  disabled={busy === selectedGroup.key}
                  className="flex items-center gap-1.5 rounded-lg border border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <BanknoteIcon className="h-3.5 w-3.5" /> Cash · ₹{(selectedGroup.totalAmount / 100).toFixed(0)}
                </button>
                <button
                  type="button"
                  onClick={() => markGroupPaid(selectedGroup, "online")}
                  disabled={busy === selectedGroup.key}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  <SmartphoneIcon className="h-3.5 w-3.5" /> Online
                </button>
                {btSupported && (
                  <button
                    type="button"
                    onClick={() => handlePrintGroup(selectedGroup)}
                    disabled={printingGroup === selectedGroup.key}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PrinterIcon className="h-3.5 w-3.5" />
                    {printingGroup === selectedGroup.key ? "Printing..." : "Print"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePdfGroup(selectedGroup)}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <DownloadIcon className="h-3.5 w-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const checkinId = selectedGroup.guestType === "hostel"
                      ? parseInt(selectedGroup.key.replace("hostel_", ""), 10)
                      : undefined;
                    onOrderMore({
                      guestType: selectedGroup.guestType,
                      checkinId,
                      guestName: selectedGroup.guestName,
                      guestPhone: selectedGroup.contactInfo || undefined,
                      roomInfo: selectedGroup.roomInfo || undefined,
                    });
                    setSelectedGroupKey(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Order More
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
          <div className="mt-3 flex items-center gap-2">
            {btSupported && (
              <button
                type="button"
                onClick={handlePrintCombined}
                disabled={printingCombined}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4" />
                {printingCombined ? "Printing..." : "Print Combined"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!preview) return;
                const combinedData: CombinedBillData = {
                  guests: preview.guests.map((g: any) => ({
                    guestName: g.guestName as string,
                    guestPhone: (g.guestPhone || "") as string,
                    roomInfo: g.roomInfo || undefined,
                    orders: ((g.orders || []) as any[]).map((o: any) => ({
                      orderNumber: o.orderNumber as string,
                      createdAt: o.createdAt as string,
                      items: ((o.items || []) as any[]).filter((i: any) => i.status !== "voided").map((i: any) => ({
                        itemName: (i.itemName || i.name || "") as string,
                        quantity: (i.quantity || 0) as number,
                        itemPrice: (i.itemPrice || i.price || 0) as number,
                        lineTotal: (i.lineTotal || 0) as number,
                        status: (i.status || "active") as string,
                      })),
                      subtotal: (o.subtotal || 0) as number,
                      tax: (o.tax || 0) as number,
                      total: (o.total || 0) as number,
                      specialInstructions: o.specialInstructions || undefined,
                    })),
                    guestSubtotal: (g.subtotal || 0) as number,
                    guestTax: (g.tax || 0) as number,
                    guestTotal: (g.subtotal || 0) as number,
                  })),
                  grandSubtotal: preview.grandTotal,
                  grandTax: Math.round(preview.grandTotal * 5 / 105),
                  grandTotal: preview.grandTotal,
                  taxRate: 5,
                  billDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                };
                generateCombinedBill(combinedData);
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <DownloadIcon className="h-4 w-4" />
              Download PDF
            </button>
          </div>
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
  const [btSupported, setBtSupported] = useState(false);
  const [printing, setPrinting] = useState<number | null>(null);
  const [modHistoryOrder, setModHistoryOrder] = useState<number | null>(null);
  const [modHistory, setModHistory] = useState<OrderModification[]>([]);
  const [modHistoryLoading, setModHistoryLoading] = useState(false);

  useEffect(() => { setBtSupported(isBluetoothSupported()); }, []);

  const fetchModHistory = async (orderId: number) => {
    if (modHistoryOrder === orderId) {
      setModHistoryOrder(null);
      return;
    }
    setModHistoryOrder(orderId);
    setModHistoryLoading(true);
    try {
      const res = await apiCall({ action: "getOrderModifications", orderId });
      if (res.ok) {
        const data = await res.json();
        setModHistory(data.modifications || []);
      }
    } catch {
      setModHistory([]);
    } finally {
      setModHistoryLoading(false);
    }
  };

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
                <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-brand-green">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                  {order.hasModifications && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Modified</span>
                  )}
                  <span className="min-w-0 truncate text-sm text-brand-green-dark">{order.guestName}</span>
                  {order.guestType === "walkin" && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Walk-in</span>}
                  {order.guestType === "hostel" && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Goko Guest</span>}
                  <PaymentBadge status={order.paymentStatus} />
                  {order.paymentStatus === "paid" && order.paymentMethod && (
                    <span className="text-xs text-brand-green-dark/40">({order.paymentMethod === "cash" ? "Cash" : order.paymentMethod === "online" ? "Online" : order.paymentMethod})</span>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className="text-xs text-brand-green-dark/50">{new Date(order.createdAt).toLocaleDateString("en-IN")} {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}</span>
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
                    <span>Payment:{" "}
                      {order.paymentStatus === "paid" && order.paymentMethod
                        ? <>Paid by {order.paymentMethod === "cash" ? "Cash" : order.paymentMethod === "online" ? "Online" : order.paymentMethod}</>
                        : <PaymentBadge status={order.paymentStatus} />
                      }
                    </span>
                    <span>
                      {order.paymentStatus === "paid" && order.paidBy
                        ? <>Paid by: {order.paidBy}</>
                        : <>By: {order.createdBy}</>
                      }
                    </span>
                  </div>
                  {order.cancelledReason && (
                    <p className="text-xs text-red-500">Cancelled: {order.cancelledReason}</p>
                  )}

                  {/* Modification History */}
                  {order.hasModifications && (
                    <div className="border-t border-brand-mist pt-2">
                      <button
                        type="button"
                        onClick={() => fetchModHistory(order.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800"
                      >
                        <HistoryIcon className="h-3.5 w-3.5" />
                        {modHistoryOrder === order.id ? "Hide" : "Show"} Modification History
                      </button>
                      {modHistoryOrder === order.id && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                          {modHistoryLoading ? (
                            <p className="text-xs text-gray-500">Loading...</p>
                          ) : modHistory.length === 0 ? (
                            <p className="text-xs text-gray-500">No modifications found</p>
                          ) : (
                            <div className="space-y-1.5">
                              {modHistory.map((mod, idx) => (
                                <div key={idx} className="flex flex-col gap-0.5 border-b border-amber-100 pb-1.5 last:border-0 last:pb-0">
                                  <span className="text-xs text-gray-800">
                                    {formatAdminModification(mod)}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(mod.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                                    {" · "}{mod.modifiedBy}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-t border-brand-mist pt-2">
                    {btSupported && (
                      <button
                        type="button"
                        onClick={async () => {
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
                        }}
                        disabled={printing === order.id}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        {printing === order.id ? "Printing..." : "Print"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const billOrders: BillOrder[] = [{
                          orderNumber: order.orderNumber,
                          createdAt: order.createdAt,
                          items: order.items.filter(i => i.status !== "voided").map(i => ({
                            itemName: i.itemName,
                            quantity: i.quantity,
                            itemPrice: i.itemPrice,
                            lineTotal: i.lineTotal,
                            status: i.status,
                          })),
                          subtotal: order.subtotal,
                          tax: order.tax,
                          total: order.total,
                          specialInstructions: order.specialInstructions || undefined,
                        }];
                        generateGuestBill({
                          guestName: order.guestName,
                          guestPhone: order.guestPhone || "",
                          roomInfo: order.roomInfo || undefined,
                          orders: billOrders,
                          grandSubtotal: order.subtotal,
                          grandTax: order.tax,
                          grandTotal: order.total,
                          taxRate: 5,
                          billDate: new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                        });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAdminModification(mod: OrderModification): string {
  const actor = mod.modifiedBy.charAt(0).toUpperCase() + mod.modifiedBy.slice(1);
  switch (mod.action) {
    case "quantity_changed":
      return `${actor} changed ${mod.itemName} qty from ${mod.oldValue} to ${mod.newValue}`;
    case "item_removed":
      return `${actor} removed ${mod.itemName}`;
    case "item_voided":
      return `${actor} voided ${mod.itemName}`;
    case "void_item":
      return `${actor} voided ${mod.itemName}`;
    case "discount":
      return `${actor} applied discount: ${mod.oldValue} → ${mod.newValue}`;
    default:
      return `${actor}: ${mod.action} on ${mod.itemName || "order"}`;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeSince(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (remainMins === 0) return `${hrs}h`;
  return `${hrs}h ${remainMins}m`;
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

