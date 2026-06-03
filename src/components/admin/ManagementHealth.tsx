"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { RefreshCwIcon, CheckCircle2Icon, XCircleIcon, Loader2Icon, LinkIcon } from "lucide-react";
import type { Role } from "./types";

type ServiceStatus = {
  name: string;
  status: "ok" | "error" | "checking";
  message?: string;
  lastChecked?: string;
};

export function ManagementHealth({ password, role }: { password: string; role: Role }) {
  const passwordRef = useRef(password);
  passwordRef.current = password;

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "D1 Database", status: "checking" },
    { name: "Google Drive", status: "checking" },
    { name: "Vision API", status: "checking" },
    { name: "Gmail", status: "checking" },
  ]);
  const [checking, setChecking] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const runHealthCheck = async () => {
    setChecking(true);
    setServices((prev) => prev.map((s) => ({ ...s, status: "checking" as const })));

    try {
      const res = await fetch("/api/admin/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordRef.current, action: "healthCheck" }),
      });
      const data = await res.json();
      if (data.results) {
        const now = new Date().toLocaleTimeString();
        setServices([
          { name: "D1 Database", status: data.results.d1.status, message: data.results.d1.message, lastChecked: now },
          { name: "Google Drive", status: data.results.drive.status, message: data.results.drive.message, lastChecked: now },
          { name: "Vision API", status: data.results.vision.status, message: data.results.vision.message, lastChecked: now },
          { name: "Gmail", status: data.results.gmail.status, message: data.results.gmail.message, lastChecked: now },
        ]);
      }
    } catch {
      setServices((prev) => prev.map((s) => ({ ...s, status: "error" as const, message: "Health check failed" })));
    } finally {
      setChecking(false);
    }
  };

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    runHealthCheck();
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_success") === "true") {
      setSuccessMsg("Google account reconnected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
    }
    const oauthErr = params.get("oauth_error");
    if (oauthErr) {
      setErrorMsg(`Google reconnect failed: ${oauthErr.replace(/_/g, " ")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const hasOAuthError = services.some(
    (s) =>
      (s.name === "Google Drive" || s.name === "Gmail") &&
      s.status === "error" &&
      (s.message?.toLowerCase().includes("oauth") ||
        s.message?.toLowerCase().includes("token") ||
        s.message?.toLowerCase().includes("reconnect"))
  );

  const handleReconnect = () => {
    window.location.href = `/api/auth/google/start?password=${encodeURIComponent(password)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-brand-green-dark">Service Health</h3>
        <button
          type="button"
          onClick={runHealthCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green transition-colors hover:bg-brand-green/20 disabled:opacity-50"
        >
          <RefreshCwIcon className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
          Check Now
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-start gap-3 rounded-xl border border-brand-mist bg-white p-4"
          >
            <div className="mt-0.5">
              {service.status === "checking" && <Loader2Icon className="h-5 w-5 animate-spin text-brand-green/50" />}
              {service.status === "ok" && <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />}
              {service.status === "error" && <XCircleIcon className="h-5 w-5 text-red-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-brand-green-dark">{service.name}</p>
              <p className={cn(
                "mt-0.5 text-xs",
                service.status === "ok" && "text-emerald-600",
                service.status === "error" && "text-red-600",
                service.status === "checking" && "text-brand-green-dark/50",
              )}>
                {service.status === "checking" && "Checking..."}
                {service.status === "ok" && "Connected"}
                {service.status === "error" && (service.message || "Connection failed")}
              </p>
              {service.lastChecked && (
                <p className="mt-1 text-[10px] text-brand-green-dark/40">Last checked: {service.lastChecked}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{errorMsg}</p>
        </div>
      )}

      {hasOAuthError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <LinkIcon className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Google OAuth token expired or missing</p>
              <p className="mt-1 text-xs text-amber-700">
                Click below to reconnect your Google account. This will fix both Drive and Gmail.
              </p>
              <button
                type="button"
                onClick={handleReconnect}
                className="mt-3 rounded-lg bg-brand-green px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-dark"
              >
                Reconnect Google
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-brand-mist bg-brand-sand/30 p-4">
        <p className="text-xs text-brand-green-dark/60">
          <strong>Note:</strong> Vision API uses a service account (auto-renewing).
          Drive & Gmail share the same OAuth token — reconnecting fixes both.
        </p>
      </div>
    </div>
  );
}
