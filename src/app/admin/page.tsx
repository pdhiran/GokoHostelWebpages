"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockIcon, LogOutIcon, LayoutDashboardIcon, BedDoubleIcon, TableIcon, CalendarDaysIcon, WrenchIcon, BookOpenIcon, KeyIcon, XIcon, WalletIcon, MenuIcon, StarIcon, WarehouseIcon, UtensilsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabWithHistory } from "@/hooks/useTabWithHistory";
// import { DarkModeToggle } from "@/components/DarkModeToggle";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import type { Role, AdminSection, ManagementTab } from "@/components/admin/types";
import { PwaInstallBanner } from "@/components/admin/PwaInstallBanner";
import { SyncStatusBar } from "@/components/admin/SyncStatusBar";
import { fadeIn, fadeInUp, fadeInScale, slideDown, staggerContainer, staggerItem, overlayVariants, modalVariants, pageTransition } from "@/lib/animations";

const tabLoader = () => <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green-dark border-t-transparent" /></div>;

const AdminDashboard = dynamic(() => import("@/components/admin/AdminDashboard").then((m) => m.AdminDashboard), { loading: tabLoader, ssr: false });
const AdminRecords = dynamic(() => import("@/components/admin/AdminRecords").then((m) => m.AdminRecords), { loading: tabLoader, ssr: false });
const AdminBeds = dynamic(() => import("@/components/admin/AdminBeds").then((m) => m.AdminBeds), { loading: tabLoader, ssr: false });
const BookingDashboard = dynamic(() => import("@/components/admin/booking-dashboard").then((m) => ({ default: m.BookingDashboard })), { loading: tabLoader, ssr: false });
const AdminManagement = dynamic(() => import("@/components/admin/AdminManagement").then((m) => m.AdminManagement), { loading: tabLoader, ssr: false });
const AdminTimeline = dynamic(() => import("@/components/admin/AdminTimeline").then((m) => m.AdminTimeline), { loading: tabLoader, ssr: false });
const AdminFoodOrders = dynamic(() => import("@/components/admin/AdminFoodOrders").then((m) => m.AdminFoodOrders), { loading: tabLoader, ssr: false });
const AdminExpenditure = dynamic(() => import("@/components/admin/AdminExpenditure").then((m) => m.AdminExpenditure), { loading: tabLoader, ssr: false });
const AdminReviews = dynamic(() => import("@/components/admin/AdminReviews").then((m) => m.AdminReviews), { loading: tabLoader, ssr: false });
const InventoryRatePlan = dynamic(() => import("@/components/admin/InventoryRatePlan").then((m) => m.InventoryRatePlan), { loading: tabLoader, ssr: false });

export default function AdminPage() {
  return (
    <Suspense fallback={
      <section className="flex min-h-screen items-center justify-center bg-brand-sand dark:bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green-dark border-t-transparent" />
      </section>
    }>
      <AdminToastProvider>
        <AdminPageInner />
      </AdminToastProvider>
    </Suspense>
  );
}

function AdminPageInner() {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useTabWithHistory<AdminSection>("section", "dashboard", {
    clearParams: ["tab"],
    validValues: ["dashboard", "bookings", "beds", "timeline", "inventory", "records", "foodOrders", "expenditure", "reviews", "management"],
  });
  const [managementTab, setManagementTab] = useState<ManagementTab | undefined>();
  const [pendingAssignGuest, setPendingAssignGuest] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "manager" | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [autoLogging, setAutoLogging] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const handleChangePassword = async () => {
    setCpError("");
    setCpSuccess("");
    if (!cpNew || !cpCurrent) { setCpError("All fields are required"); return; }
    if (cpNew !== cpConfirm) { setCpError("New passwords do not match"); return; }
    if (!cpNew) { setCpError("Password cannot be empty"); return; }
    setCpLoading(true);
    try {
      const res = await fetch("/api/admin/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "changeMyPassword", currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) { setCpError(data.error || "Failed to change password"); return; }
      setCpSuccess("Password changed successfully!");
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      setPassword(cpNew);
      if (rememberMe) {
        localStorage.setItem("gokoAdminSession", JSON.stringify({ password: cpNew, username: username || "" }));
      }
    } catch {
      setCpError("Something went wrong");
    } finally {
      setCpLoading(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gokoAdminSession");
      if (saved) {
        const session = JSON.parse(saved);
        if (session.password) {
          setPassword(session.password);
          setUsername(session.username || "");
          setRememberMe(true);
          const body: any = { password: session.password, action: "list" };
          if (session.username) body.username = session.username;
          fetch("/api/admin/checkins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              setRole(data.role);
              setPermissions(data.permissions || {});
            } else {
              localStorage.removeItem("gokoAdminSession");
            }
            setAutoLogging(false);
          }).catch(() => { setAutoLogging(false); });
          return;
        }
      }
    } catch {}
    setAutoLogging(false);
  }, []);

  useEffect(() => {
    if (!role || role === "admin") return;
    const navIds: AdminSection[] = ["dashboard", "bookings", "beds", "timeline", "inventory", "records", "foodOrders", "expenditure", "reviews", "management"];
    const permKeys: Record<AdminSection, string> = {
      dashboard: "canViewDashboard", bookings: "canViewBookings", beds: "canViewBeds",
      timeline: "canViewTimeline", inventory: "canManageInventory", records: "canViewRecords", foodOrders: "canViewFoodOrders",
      expenditure: "canViewAccounts", reviews: "canViewReviews", management: "canViewManagement",
    };
    const isVisible = (id: AdminSection) => permissions[permKeys[id]] || false;
    if (!isVisible(section)) {
      const first = navIds.find(isVisible);
      if (first) setSection(first);
    }
  }, [role, permissions, section, setSection]);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const body: any = { password, action: "list" };
      if (selectedRole === "manager" && username) body.username = username;

      const res = await fetch("/api/admin/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { setError("Incorrect credentials"); return; }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRole(data.role);
      setPermissions(data.permissions || {});
      if (rememberMe) {
        localStorage.setItem("gokoAdminSession", JSON.stringify({ password, username: username || "" }));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setRole(null);
    setPassword("");
    setUsername("");
    setSection("dashboard");
    setSelectedRole(null);
    setPermissions({});
    localStorage.removeItem("gokoAdminSession");
  };

  if (autoLogging) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-brand-sand dark:bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green-dark border-t-transparent" />
      </section>
    );
  }

  if (!role) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-brand-sand dark:bg-background">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInScale}
          className="mx-4 w-full max-w-sm rounded-3xl border border-brand-mist bg-white dark:bg-card p-6 shadow-card dark:shadow-none sm:mx-auto sm:p-8"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/[0.07]">
            <LockIcon className="h-6 w-6 text-brand-green" />
          </div>
          <h1 className="mt-5 text-center font-display text-xl font-bold text-brand-green">
            Goko Check-in Panel
          </h1>

          <AnimatePresence mode="wait">
            {!selectedRole ? (
              <motion.div
                key="role-select"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-6 space-y-3"
              >
                <p className="text-center text-sm text-brand-green-dark/70 dark:text-zinc-400">Select your access level</p>
                <button
                  type="button"
                  onClick={() => setSelectedRole("admin")}
                  className="w-full rounded-xl border-2 border-brand-green bg-white dark:bg-card px-4 py-4 text-left transition-all duration-200 hover:bg-brand-green/[0.04] dark:hover:bg-zinc-800 hover:shadow-soft dark:hover:shadow-none hover:-translate-y-0.5"
                >
                  <span className="font-display text-base font-bold text-brand-green">Admin Access</span>
                  <p className="mt-0.5 text-xs text-brand-green-dark/60 dark:text-muted-foreground">Full access: view, add, modify, and delete entries</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("manager")}
                  className="w-full rounded-xl border-2 border-brand-mist dark:border-zinc-700 bg-white dark:bg-card px-4 py-4 text-left transition-all duration-200 hover:border-brand-green/30 hover:shadow-soft dark:hover:shadow-none hover:-translate-y-0.5"
                >
                  <span className="font-display text-base font-bold text-brand-green-dark dark:text-zinc-200">Staff Access</span>
                  <p className="mt-0.5 text-xs text-brand-green-dark/60 dark:text-muted-foreground">View records and add new entries</p>
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="login-form"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={(e) => { e.preventDefault(); login(); }}
                className="mt-6 space-y-4"
              >
                <p className="text-center text-sm text-brand-green-dark/70 dark:text-zinc-400">
                  {selectedRole === "admin" ? "Enter admin password" : "Staff login"}
                </p>
                {selectedRole === "manager" && (
                  <div>
                    <Label htmlFor="staff-user">Username</Label>
                    <Input
                      id="staff-user"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      autoFocus
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="admin-pw">Password</Label>
                  <Input
                    id="admin-pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus={selectedRole === "admin"}
                  />
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <label className="flex items-center gap-2 text-sm text-brand-green-dark/70 dark:text-zinc-400">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-brand-mist dark:border-zinc-600" />
                  Keep me signed in
                </label>
                <Button type="submit" variant="cta" className="w-full" disabled={loading || !password || (selectedRole === "manager" && !username)}>
                  {loading ? "Verifying..." : "Login"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setSelectedRole(null); setPassword(""); setUsername(""); setError(""); }}
                  className="w-full text-center text-sm text-brand-green-dark/60 dark:text-zinc-500 transition-colors hover:text-brand-green"
                >
                  Back to role selection
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    );
  }

  const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ReactNode; adminOnly?: boolean; permission?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboardIcon className="h-4 w-4" />, permission: "canViewDashboard" },
    { id: "bookings", label: "Bookings", icon: <BookOpenIcon className="h-4 w-4" />, permission: "canViewBookings" },
    { id: "beds", label: "Beds", icon: <BedDoubleIcon className="h-4 w-4" />, permission: "canViewBeds" },
    { id: "timeline", label: "Timeline", icon: <CalendarDaysIcon className="h-4 w-4" />, permission: "canViewTimeline" },
    { id: "inventory", label: "Inventory", icon: <WarehouseIcon className="h-4 w-4" />, permission: "canManageInventory" },
    { id: "records", label: "Records", icon: <TableIcon className="h-4 w-4" />, permission: "canViewRecords" },
    { id: "foodOrders", label: "Food Orders", icon: <UtensilsIcon className="h-4 w-4" />, permission: "canViewFoodOrders" },
    { id: "expenditure", label: "Accounts", icon: <WalletIcon className="h-4 w-4" />, permission: "canViewAccounts" },
    { id: "reviews", label: "Reviews", icon: <StarIcon className="h-4 w-4" />, permission: "canViewReviews" },
    { id: "management", label: "Management", icon: <WrenchIcon className="h-4 w-4" />, permission: "canViewManagement" },
  ];

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    if (item.permission && role !== "admin" && !permissions[item.permission]) return false;
    return true;
  });

  const fillViewport = section === "inventory" || section === "bookings";

  return (
    <section className={cn(
      "flex flex-col bg-brand-sand dark:bg-background",
      fillViewport ? "h-dvh" : "min-h-screen",
    )}>
      {/* Top navigation */}
      <nav className="sticky top-0 z-30 shrink-0 border-b border-brand-mist dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2 sm:px-6">
          {/* Mobile/Tablet hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-brand-green-dark/70 dark:text-zinc-400 transition-colors hover:bg-brand-green/[0.06] dark:hover:bg-zinc-800 lg:hidden"
          >
            <motion.div animate={{ rotate: mobileMenuOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </motion.div>
          </button>

          {/* Desktop nav with animated pill indicator */}
          <div className="hidden items-center gap-1 overflow-x-auto lg:flex">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  section === item.id
                    ? "text-white"
                    : "text-brand-green-dark/70 dark:text-zinc-400 hover:bg-brand-green/[0.06] dark:hover:bg-zinc-800"
                )}
              >
                {section === item.id && (
                  <motion.span
                    layoutId="admin-nav-pill"
                    className="absolute inset-0 rounded-lg bg-brand-green"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Active section label on mobile/tablet */}
          <span className="text-sm font-semibold text-brand-green-dark dark:text-zinc-200 lg:hidden">
            {NAV_ITEMS.find((i) => i.id === section)?.label || "Admin"}
          </span>

          <div className="flex items-center gap-3">
            <PwaInstallBanner password={password} username={username} />
            <span className="hidden text-xs font-medium uppercase tracking-wide text-brand-green-dark/50 dark:text-zinc-500 sm:inline">
              {username ? `${username} · ${role}` : role}
            </span>
            {username && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setShowChangePassword(true); setCpError(""); setCpSuccess(""); }}
                className="gap-1 text-xs"
              >
                <KeyIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Change Password</span>
              </Button>
            )}
            {/* <DarkModeToggle className="text-brand-green-dark/70 hover:bg-brand-green/[0.06] dark:text-foreground dark:hover:bg-muted" /> */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
            >
              <LogOutIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile/Tablet menu dropdown — animated */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              variants={slideDown}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden border-t border-brand-mist dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm lg:hidden"
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 gap-1.5 px-4 py-3 sm:grid-cols-4"
              >
                {visibleNavItems.map((item) => (
                  <motion.button
                    key={item.id}
                    variants={staggerItem}
                    type="button"
                    onClick={() => { setSection(item.id); setMobileMenuOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      section === item.id
                        ? "bg-brand-green text-white dark:text-zinc-900 shadow-sm"
                        : "text-brand-green-dark/70 dark:text-zinc-400 hover:bg-brand-green/[0.06] dark:hover:bg-zinc-800"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Sync status bar */}
      {role === "admin" && (
        <div className="shrink-0">
          <SyncStatusBar
            password={password}
            username={username}
            role={role}
            onNavigateToSync={() => { setManagementTab("serverSync"); setSection("management"); }}
          />
        </div>
      )}

      {/* Section content — animated tab transitions */}
      <div className={cn(
        "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6",
        fillViewport && "flex min-h-0 flex-1 flex-col",
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            variants={fillViewport ? fadeIn : pageTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(fillViewport && "flex h-full min-h-0 flex-1 flex-col")}
          >
            {section === "dashboard" && <AdminDashboard password={password} username={username} role={role} onNavigate={(s, opts) => { if (opts?.assignGuestContact) setPendingAssignGuest(opts.assignGuestContact); setSection(s); }} permissions={permissions} />}
            {section === "bookings" && <BookingDashboard password={password} username={username} role={role} permissions={permissions} />}
            {section === "beds" && <AdminBeds password={password} username={username} role={role} permissions={permissions} pendingAssignGuest={pendingAssignGuest} onPendingAssignConsumed={() => setPendingAssignGuest(null)} />}
            {section === "timeline" && <AdminTimeline password={password} username={username} role={role} permissions={permissions} />}
            {section === "inventory" && <InventoryRatePlan password={password} username={username} role={role} permissions={permissions} />}
            {section === "records" && <AdminRecords password={password} username={username} role={role} permissions={permissions} />}
            {section === "foodOrders" && <AdminFoodOrders password={password} username={username} role={role} permissions={permissions} />}
            {section === "expenditure" && <AdminExpenditure password={password} username={username} role={role} permissions={permissions} />}
            {section === "reviews" && <AdminReviews password={password} username={username} role={role} permissions={permissions} />}
            {section === "management" && <AdminManagement password={password} username={username} role={role} permissions={permissions} initialTab={managementTab} onTabUsed={() => setManagementTab(undefined)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Change Password Modal — animated */}
      <AnimatePresence>
        {showChangePassword && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowChangePassword(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="pointer-events-auto w-full max-w-sm rounded-2xl border border-brand-mist bg-white dark:bg-card p-5 shadow-xl dark:shadow-none sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-brand-green-dark dark:text-zinc-100">Change Password</h3>
                  <button type="button" onClick={() => setShowChangePassword(false)} className="rounded-md p-1 text-brand-green-dark/40 dark:text-zinc-500 transition-colors hover:text-brand-green-dark dark:hover:text-zinc-200">
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="cp-current">Current Password</Label>
                    <Input id="cp-current" type="password" value={cpCurrent} onChange={(e) => setCpCurrent(e.target.value)} placeholder="Enter current password" />
                  </div>
                  <div>
                    <Label htmlFor="cp-new">New Password</Label>
                    <Input id="cp-new" type="password" value={cpNew} onChange={(e) => setCpNew(e.target.value)} placeholder="Enter new password" />
                  </div>
                  <div>
                    <Label htmlFor="cp-confirm">Confirm New Password</Label>
                    <Input id="cp-confirm" type="password" value={cpConfirm} onChange={(e) => setCpConfirm(e.target.value)} placeholder="Confirm new password" />
                  </div>
                  <AnimatePresence>
                    {cpError && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-red-500">{cpError}</motion.p>
                    )}
                    {cpSuccess && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-sm text-green-600">{cpSuccess}</motion.p>
                    )}
                  </AnimatePresence>
                  <Button type="button" variant="cta" className="w-full" onClick={handleChangePassword} disabled={cpLoading}>
                    {cpLoading ? "Saving..." : "Save New Password"}
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
