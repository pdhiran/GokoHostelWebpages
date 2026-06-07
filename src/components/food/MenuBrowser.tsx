"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Category {
  id: number;
  name: string;
  nameKannada: string;
  icon: string;
  description: string;
  displayOrder: number;
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
  ingredients: string;
  imageUrl: string;
  isAvailable: number;
  displayOrder: number;
}

export interface CartItem {
  menuItemId: number;
  name: string;
  nameKannada: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

interface MenuBrowserProps {
  categories: Category[];
  items: MenuItem[];
  cart: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onRemoveFromCart: (menuItemId: number) => void;
}

type DietFilter = "all" | "veg" | "nonveg";

function parseTags(tagsStr: string): string[] {
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

export function MenuBrowser({ categories, items, cart, onAddToCart, onRemoveFromCart }: MenuBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [dietFilter, setDietFilter] = useState<DietFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const filteredItems = useMemo(() => {
    let result = items.filter((i) => i.categoryId === selectedCategory);
    result = result.sort((a, b) => a.displayOrder - b.displayOrder);

    if (dietFilter !== "all") {
      result = result.filter((item) => {
        const tags = parseTags(item.tags).map((t) => t.toLowerCase());
        if (dietFilter === "veg") return tags.includes("veg");
        return tags.includes("non-veg") || tags.includes("nonveg");
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.nameKannada && item.nameKannada.includes(q))
      );
    }

    return result;
  }, [items, selectedCategory, dietFilter, searchQuery]);

  const getCartQuantity = (menuItemId: number): number => {
    const found = cart.find((c) => c.menuItemId === menuItemId);
    return found?.quantity || 0;
  };

  const handleAdd = (item: MenuItem) => {
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      nameKannada: item.nameKannada || "",
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl || "",
    });
  };

  if (selectedCategory === null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 pb-24"
      >
        <h2 className="mb-4 text-xl font-bold text-gray-800">Menu</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedCategories.map((cat) => (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
              {cat.nameKannada && (
                <span className="text-xs text-gray-500">{cat.nameKannada}</span>
              )}
              {cat.description && (
                <span className="line-clamp-2 text-center text-[11px] text-gray-400">
                  {cat.description}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  const currentCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-4 pb-24"
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSearchQuery("");
            setDietFilter("all");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            {currentCategory?.icon} {currentCategory?.name}
          </h2>
          {currentCategory?.nameKannada && (
            <p className="text-xs text-gray-500">{currentCategory.nameKannada}</p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search dishes…"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Diet filter */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setDietFilter("all")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            dietFilter === "all"
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setDietFilter("veg")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            dietFilter === "veg"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-green-50"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Veg
        </button>
        <button
          onClick={() => setDietFilter("nonveg")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
            dietFilter === "nonveg"
              ? "bg-red-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-red-50"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Non-veg
        </button>
      </div>

      {/* Items grid */}
      <AnimatePresence mode="popLayout">
        {filteredItems.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center text-sm text-gray-500"
          >
            No items found
          </motion.p>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const tags = parseTags(item.tags);
              const isUnavailable = item.isAvailable !== 1 || item.price <= 0;
              const qty = getCartQuantity(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileTap={isUnavailable ? undefined : { scale: 0.98 }}
                  className={`flex gap-3 rounded-2xl border bg-white p-3 shadow-sm transition ${
                    isUnavailable
                      ? "border-gray-100 opacity-50"
                      : "border-gray-100 hover:border-blue-100 hover:shadow-md"
                  }`}
                >
                  {/* Image */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 leading-tight">
                        {item.name}
                      </h3>
                      {item.nameKannada && (
                        <p className="text-xs text-gray-500">{item.nameKannada}</p>
                      )}
                      {item.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">
                          {item.description}
                        </p>
                      )}
                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tags.map((tag) => {
                            const lc = tag.toLowerCase();
                            let classes = "bg-gray-100 text-gray-600";
                            if (lc === "veg") classes = "bg-green-50 text-green-700";
                            else if (lc === "non-veg" || lc === "nonveg") classes = "bg-red-50 text-red-700";
                            else if (lc === "spicy") classes = "bg-amber-50 text-amber-700";
                            return (
                              <span
                                key={tag}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${classes}`}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800">
                        {isUnavailable ? (
                          <span className="text-gray-400">Unavailable</span>
                        ) : (
                          formatPrice(item.price)
                        )}
                      </span>

                      {!isUnavailable && (
                        <>
                          {qty === 0 ? (
                            <button
                              onClick={() => handleAdd(item)}
                              className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-0.5">
                              <button
                                onClick={() => onRemoveFromCart(item.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-100"
                              >
                                −
                              </button>
                              <span className="min-w-[16px] text-center text-sm font-semibold text-blue-700">
                                {qty}
                              </span>
                              <button
                                onClick={() => handleAdd(item)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-blue-600 transition hover:bg-blue-100"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
