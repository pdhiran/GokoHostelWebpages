"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneEntry, type GuestInfo } from "@/components/food/PhoneEntry";
import { MenuBrowser, type CartItem } from "@/components/food/MenuBrowser";
import { FoodCart, type CartItemData, type GuestInfoData } from "@/components/food/FoodCart";

type View = "loading" | "closed" | "phone" | "menu" | "cart";

interface MenuSettings {
  kitchenOpen: string;
  kitchenClose: string;
  isBusy: boolean;
  taxRate: number;
  whatsappNumber: string;
}

interface MenuCategory {
  id: number;
  name: string;
  nameKannada: string;
  icon: string;
  description: string;
  displayOrder: number;
}

interface MenuItemData {
  id: number;
  categoryId: number;
  name: string;
  nameKannada: string;
  description: string;
  price: number;
  priceText: string;
  tags: string;
  ingredients: string;
  imageUrl: string;
  isAvailable: number;
  displayOrder: number;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function getISTMinutes(): number {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return ist.getHours() * 60 + ist.getMinutes();
}

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem("gokoFoodCart");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveCartToStorage(cart: CartItem[]) {
  try {
    localStorage.setItem("gokoFoodCart", JSON.stringify(cart));
  } catch {}
}

export default function FoodOrderPage() {
  const [view, setView] = useState<View>("loading");
  const [settings, setSettings] = useState<MenuSettings | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [guestInfo, setGuestInfo] = useState<GuestInfoData | null>(null);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    const stored = loadCartFromStorage();
    if (stored.length > 0) setCart(stored);

    const phone = localStorage.getItem("gokoFoodPhone") || null;
    setSavedPhone(phone);

    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await fetch("/api/food/menu");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setCategories(data.categories || []);
      setItems(data.items || []);
      setSettings(data.settings);

      const s = data.settings as MenuSettings;
      const currentMin = getISTMinutes();
      const openMin = timeToMinutes(s.kitchenOpen);
      const closeMin = timeToMinutes(s.kitchenClose);

      if (currentMin < openMin || currentMin >= closeMin) {
        setView("closed");
      } else {
        setView("phone");
      }
    } catch {
      setFetchError("Unable to load menu. Please try again.");
      setView("closed");
    }
  };

  const handleIdentified = useCallback((guest: GuestInfo) => {
    setGuestInfo({
      name: guest.name,
      phone: guest.phone,
      checkinId: guest.checkinId,
      guestType: guest.guestType,
      roomInfo: guest.roomInfo,
    });
    setView("menu");
  }, []);

  const handleWalkin = useCallback((phone: string) => {
    setGuestInfo({
      name: "",
      phone,
      checkinId: null,
      guestType: "walkin",
      roomInfo: "",
    });
    setView("menu");
  }, []);

  const handleAddToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.menuItemId);
      let next: CartItem[];
      if (existing) {
        next = prev.map((c) =>
          c.menuItemId === item.menuItemId ? { ...c, quantity: c.quantity + 1 } : c
        );
      } else {
        next = [...prev, { ...item, quantity: 1 }];
      }
      saveCartToStorage(next);
      return next;
    });
  }, []);

  const handleRemoveFromCart = useCallback((menuItemId: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === menuItemId);
      if (!existing) return prev;
      let next: CartItem[];
      if (existing.quantity <= 1) {
        next = prev.filter((c) => c.menuItemId !== menuItemId);
      } else {
        next = prev.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      saveCartToStorage(next);
      return next;
    });
  }, []);

  const handleUpdateQuantity = useCallback((menuItemId: number, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === menuItemId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      let next: CartItem[];
      if (newQty <= 0) {
        next = prev.filter((c) => c.menuItemId !== menuItemId);
      } else {
        next = prev.map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: newQty } : c
        );
      }
      saveCartToStorage(next);
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((menuItemId: number) => {
    setCart((prev) => {
      const next = prev.filter((c) => c.menuItemId !== menuItemId);
      saveCartToStorage(next);
      return next;
    });
  }, []);

  const handleOrderPlaced = useCallback(() => {
    setCart([]);
    saveCartToStorage([]);
  }, []);

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Loading state
  if (view === "loading") {
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

  // Kitchen closed state
  if (view === "closed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl backdrop-blur-sm"
        >
          <span className="text-5xl">🌙</span>
          <h1 className="mt-4 text-xl font-bold text-gray-800">Kitchen is Closed</h1>
          {fetchError ? (
            <p className="mt-2 text-sm text-gray-600">{fetchError}</p>
          ) : settings ? (
            <>
              <p className="mt-2 text-gray-600">
                We&apos;re open from{" "}
                <span className="font-semibold">{settings.kitchenOpen}</span> to{" "}
                <span className="font-semibold">{settings.kitchenClose}</span> IST
              </p>
              <p className="mt-1 text-sm text-gray-500">Come back at {settings.kitchenOpen}!</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-600">Please try again later.</p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400">
      {/* Busy banner */}
      {settings?.isBusy && view !== "phone" && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Kitchen is busy — longer wait times expected
        </motion.div>
      )}

      <div className="mx-auto max-w-lg pb-8 pt-8">
        <AnimatePresence mode="wait">
          {view === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <PhoneEntry
                onIdentified={handleIdentified}
                onWalkin={handleWalkin}
                savedPhone={savedPhone || undefined}
              />
            </motion.div>
          )}

          {view === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              {/* Header */}
              <div className="mb-4 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold text-white">
                      {guestInfo?.guestType === "hostel"
                        ? `Hi, ${guestInfo.name?.split(" ")[0]}! 👋`
                        : "Welcome! 👋"}
                    </h1>
                    {guestInfo?.roomInfo && (
                      <p className="text-sm text-blue-100">{guestInfo.roomInfo}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-t-3xl bg-gray-50 pt-5">
                <MenuBrowser
                  categories={categories}
                  items={items}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                />
              </div>
            </motion.div>
          )}

          {view === "cart" && guestInfo && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="rounded-t-3xl bg-gray-50 pt-5">
                <FoodCart
                  cart={cart as CartItemData[]}
                  guestInfo={guestInfo}
                  taxRate={settings?.taxRate || 5}
                  whatsappNumber={settings?.whatsappNumber || ""}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onOrderPlaced={handleOrderPlaced}
                  onBack={() => setView("menu")}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating cart button */}
      {view === "menu" && cartCount > 0 && (
        <motion.button
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView("cart")}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 shadow-2xl shadow-blue-500/30"
        >
          <div className="relative">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
              {cartCount}
            </span>
          </div>
          <span className="text-sm font-bold text-white">View Cart</span>
          <span className="text-sm font-medium text-blue-100">
            ₹{Math.round(cart.reduce((s, c) => s + c.price * c.quantity, 0) / 100)}
          </span>
        </motion.button>
      )}
    </div>
  );
}
