"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LockIcon } from "lucide-react";
import { KitchenDashboard } from "@/components/kitchen/KitchenDashboard";
import { fadeInScale } from "@/lib/animations";

export default function KitchenPage() {
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("kitchen_pw");
    if (saved) setPassword(saved);
  }, []);

  // Auth is handled via the kitchen API password independently.
  // The canAccessKitchen permission in the admin panel controls visibility/assignment only.
  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/food/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: inputPassword, action: "listOrders" }),
      });
      if (res.status === 401) {
        setError("Incorrect password");
        return;
      }
      if (!res.ok) throw new Error("Failed");
      sessionStorage.setItem("kitchen_pw", inputPassword);
      setPassword(inputPassword);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("kitchen_pw");
    setPassword("");
    setInputPassword("");
  };

  if (!password) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-background">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInScale}
          className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-border bg-white dark:bg-card p-8 shadow-lg"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
            <LockIcon className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="mt-5 text-center text-xl font-bold text-gray-900 dark:text-foreground">
            Kitchen Dashboard
          </h1>
          <p className="mt-1 text-center text-sm text-gray-500 dark:text-muted-foreground">
            Enter staff password to access
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
            className="mt-6 space-y-4"
          >
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full rounded-xl border border-gray-300 dark:border-border bg-white dark:bg-muted px-4 py-3 text-gray-900 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground outline-none transition-all duration-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/30 focus:shadow-sm"
            />
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-red-500">{error}</motion.p>
              )}
            </AnimatePresence>
            <button
              type="submit"
              disabled={loading || !inputPassword}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {loading ? "Verifying..." : "Enter Kitchen"}
            </button>
          </form>
        </motion.div>
      </section>
    );
  }

  return <KitchenDashboard password={password} onLogout={logout} />;
}
