"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockIcon, LogOutIcon, LayoutDashboardIcon, BedDoubleIcon, TableIcon, CalendarDaysIcon, WrenchIcon, BookOpenIcon, KeyIcon, XIcon, WalletIcon, MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminRecords } from "@/components/admin/AdminRecords";
import { AdminBeds } from "@/components/admin/AdminBeds";
import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminManagement } from "@/components/admin/AdminManagement";
import { AdminTimeline } from "@/components/admin/AdminTimeline";
import { AdminFoodOrders } from "@/components/admin/AdminFoodOrders";
import { AdminExpenditure } from "@/components/admin/AdminExpenditure";
import type { Role, AdminSection } from "@/components/admin/types";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");
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
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const exitIntentRef = useRef(false);

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

  const handlePopState = useCallback(() => {
    if (exitIntentRef.current) return;
    history.pushState({ gokoAdmin: true }, "");
    setShowExitDialog(true);
  }, []);

  useEffect(() => {
    if (!role) return;
    history.pushState({ gokoAdmin: true }, "");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [role, handlePopState]);

  const confirmExit = () => {
    exitIntentRef.current = true;
    setShowExitDialog(false);
    history.go(-2);
    setTimeout(() => { exitIntentRef.current = false; }, 500);
  };

  const cancelExit = () => {
    setShowExitDialog(false);
  };

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
      <section className="flex min-h-screen items-center justify-center bg-brand-sand">
        <p className="text-sm text-brand-green-dark/50">Loading...</p>
      </section>
    );
  }

  if (!role) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-brand-sand">
        <div className="w-full max-w-sm rounded-3xl border border-brand-mist bg-white p-8 shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/[0.07]">
            <LockIcon className="h-6 w-6 text-brand-green" />
          </div>
          <h1 className="mt-5 text-center font-display text-xl font-bold text-brand-green">
            Goko Check-in Panel
          </h1>

          {!selectedRole ? (
            <div className="mt-6 space-y-3">
              <p className="text-center text-sm text-brand-green-dark/70">Select your access level</p>
              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className="w-full rounded-xl border-2 border-brand-green bg-white px-4 py-4 text-left transition-all hover:bg-brand-green/[0.04] hover:shadow-soft"
              >
                <span className="font-display text-base font-bold text-brand-green">Admin Access</span>
                <p className="mt-0.5 text-xs text-brand-green-dark/60">Full access: view, add, modify, and delete entries</p>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole("manager")}
                className="w-full rounded-xl border-2 border-brand-mist bg-white px-4 py-4 text-left transition-all hover:border-brand-green/30 hover:shadow-soft"
              >
                <span className="font-display text-base font-bold text-brand-green-dark">Staff Access</span>
                <p className="mt-0.5 text-xs text-brand-green-dark/60">View records and add new entries</p>
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); login(); }} className="mt-6 space-y-4">
              <p className="text-center text-sm text-brand-green-dark/70">
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
              {error && <p className="text-sm text-red-500">{error}</p>}
              <label className="flex items-center gap-2 text-sm text-brand-green-dark/70">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-brand-mist" />
                Keep me signed in
              </label>
              <Button type="submit" variant="cta" className="w-full" disabled={loading || !password || (selectedRole === "manager" && !username)}>
                {loading ? "Verifying..." : "Login"}
              </Button>
              <button
                type="button"
                onClick={() => { setSelectedRole(null); setPassword(""); setUsername(""); setError(""); }}
                className="w-full text-center text-sm text-brand-green-dark/60 hover:text-brand-green"
              >
                Back to role selection
              </button>
            </form>
          )}
        </div>
      </section>
    );
  }

  const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboardIcon className="h-4 w-4" /> },
    { id: "bookings", label: "Bookings", icon: <BookOpenIcon className="h-4 w-4" /> },
    { id: "beds", label: "Beds", icon: <BedDoubleIcon className="h-4 w-4" /> },
    { id: "timeline", label: "Timeline", icon: <CalendarDaysIcon className="h-4 w-4" /> },
    { id: "records", label: "Records", icon: <TableIcon className="h-4 w-4" /> },
    { id: "foodOrders", label: "Food Orders", icon: <span className="text-base leading-none">🍽️</span> },
    { id: "expenditure", label: "Expenditure", icon: <WalletIcon className="h-4 w-4" /> },
    { id: "management", label: "Management", icon: <WrenchIcon className="h-4 w-4" /> },
  ];

  return (
    <section className="min-h-screen bg-brand-sand">
      {/* Top navigation */}
      <nav className="sticky top-0 z-30 border-b border-brand-mist bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2 sm:px-6">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-brand-green-dark/70 hover:bg-brand-green/[0.06] md:hidden"
          >
            {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 overflow-x-auto md:flex">
            {NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin").map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  section === item.id
                    ? "bg-brand-green text-white"
                    : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Active section label on mobile */}
          <span className="text-sm font-semibold text-brand-green-dark md:hidden">
            {NAV_ITEMS.find((i) => i.id === section)?.label || "Admin"}
          </span>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-medium uppercase tracking-wide text-brand-green-dark/50 sm:inline">
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

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-brand-mist bg-white px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-1.5">
              {NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin").map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setSection(item.id); setMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    section === item.id
                      ? "bg-brand-green text-white"
                      : "text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Section content */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {section === "dashboard" && <AdminDashboard password={password} username={username} role={role} onNavigate={setSection} />}
        {section === "bookings" && <AdminBookings password={password} username={username} role={role} />}
        {section === "beds" && <AdminBeds password={password} username={username} role={role} />}
        {section === "timeline" && <AdminTimeline password={password} username={username} role={role} />}
        {section === "records" && <AdminRecords password={password} username={username} role={role} />}
        {section === "foodOrders" && <AdminFoodOrders password={password} username={username} role={role} />}
        {section === "expenditure" && <AdminExpenditure password={password} username={username} role={role} permissions={permissions} />}
        {section === "management" && <AdminManagement password={password} username={username} role={role} permissions={permissions} />}
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-brand-mist bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-green-dark">Change Password</h3>
              <button type="button" onClick={() => setShowChangePassword(false)} className="rounded-md p-1 text-brand-green-dark/40 hover:text-brand-green-dark">
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
              {cpError && <p className="text-sm text-red-500">{cpError}</p>}
              {cpSuccess && <p className="text-sm text-green-600">{cpSuccess}</p>}
              <Button type="button" variant="cta" className="w-full" onClick={handleChangePassword} disabled={cpLoading}>
                {cpLoading ? "Saving..." : "Save New Password"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-brand-mist bg-white p-6 shadow-xl">
            <h3 className="font-display text-base font-bold text-brand-green-dark">Exit Management?</h3>
            <p className="mt-2 text-sm text-brand-green-dark/70">
              Do you want to leave the Goko management page?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancelExit}
                className="flex-1 rounded-lg border border-brand-mist px-4 py-2 text-sm font-medium text-brand-green-dark hover:bg-brand-sand"
              >
                No, stay
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, exit
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
