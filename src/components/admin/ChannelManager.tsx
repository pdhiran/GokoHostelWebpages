"use client";

import { useState, useEffect } from "react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminLoading } from "./AdminLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  RefreshCwIcon, SaveIcon, PlusIcon, Trash2Icon,
  CheckCircleIcon, XCircleIcon, Loader2Icon, WifiIcon, SendIcon,
} from "lucide-react";
import type { Role } from "./types";

function useChannelApi(password: string, username?: string) {
  const call = async (url: string, body: Record<string, any> = {}) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };
  return { call };
}

type ChannelConfig = {
  id?: number;
  provider: string;
  hotelCode: string;
  pmsId: string;
  apiBaseUrl: string;
  apiUsername: string;
  apiPassword: string;
  webhookSecret: string;
  bookingEngineUrl: string;
  isActive: number;
  lastSyncAt: string;
};

type RoomMapping = {
  id?: number;
  dormId: number;
  dormName: string;
  channelRoomCode: string;
  totalInventory: number;
  isActive: number;
};

type RatePlan = {
  id?: number;
  roomMappingId: number;
  ratePlanCode: string;
  ratePlanName: string;
  isActive: number;
};

type SyncLog = {
  id: number;
  direction: string;
  type: string;
  status: string;
  errorMessage: string;
  recordsAffected: number;
  createdAt: string;
};

const TABS = ["config", "rooms", "rates", "sync"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  config: "Configuration",
  rooms: "Room Mapping",
  rates: "Rate Plans",
  sync: "Sync & Logs",
};

const DEFAULT_CONFIG: ChannelConfig = {
  provider: "aiosell",
  hotelCode: "SANDBOX-PMS",
  pmsId: "sample-pms",
  apiBaseUrl: "https://live.aiosell.com",
  apiUsername: "aiosell",
  apiPassword: "AIOsell@123",
  webhookSecret: "",
  bookingEngineUrl: "",
  isActive: 0,
  lastSyncAt: "",
};

export function ChannelManager({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [tab, setTab] = useState<Tab>("config");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
              tab === t ? "bg-brand-green text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "config" && <ConfigTab password={password} username={username} />}
      {tab === "rooms" && <RoomMappingTab password={password} username={username} />}
      {tab === "rates" && <RatePlansTab password={password} username={username} />}
      {tab === "sync" && <SyncTab password={password} username={username} />}
    </div>
  );
}

function ConfigTab({ password, username }: { password: string; username?: string }) {
  const { call: apiCall } = useChannelApi(password, username);
  const { showError } = useAdminToast();
  const [config, setConfig] = useState<ChannelConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/admin/channel-manager", { action: "getConfig" });
      if (res.config) setConfig(res.config);
    } catch (e: any) { showError(e.message); }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await apiCall("/api/admin/channel-manager", { action: "saveConfig", config });
      showError("Configuration saved");
    } catch (e: any) { showError(e.message); }
    setSaving(false);
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Aiosell Connection</h3>
        <div className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded-full", config.isActive ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
          {config.isActive ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
          {config.isActive ? "Active" : "Inactive"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Hotel Code</label>
          <Input value={config.hotelCode} onChange={(e) => setConfig({ ...config, hotelCode: e.target.value })} placeholder="SANDBOX-PMS" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">PMS Identifier (URL path)</label>
          <Input value={config.pmsId} onChange={(e) => setConfig({ ...config, pmsId: e.target.value })} placeholder="sample-pms" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">API Base URL</label>
          <Input value={config.apiBaseUrl} onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })} placeholder="https://live.aiosell.com" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">API Username</label>
          <Input value={config.apiUsername} onChange={(e) => setConfig({ ...config, apiUsername: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">API Password</label>
          <Input type="password" value={config.apiPassword} onChange={(e) => setConfig({ ...config, apiPassword: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Webhook Secret (optional)</label>
          <Input value={config.webhookSecret} onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })} placeholder="Shared secret for inbound auth" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Booking Engine URL (for direct guests)</label>
          <Input value={config.bookingEngineUrl} onChange={(e) => setConfig({ ...config, bookingEngineUrl: e.target.value })} placeholder="https://..." />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={config.isActive === 1}
            onChange={(e) => setConfig({ ...config, isActive: e.target.checked ? 1 : 0 })}
            className="rounded"
          />
          Enable Channel Manager
        </label>
      </div>

      {config.lastSyncAt && (
        <p className="text-xs text-muted-foreground">Last sync: {new Date(config.lastSyncAt).toLocaleString()}</p>
      )}

      <Button onClick={saveConfig} disabled={saving} size="sm">
        {saving ? <Loader2Icon className="h-3.5 w-3.5 animate-spin mr-1" /> : <SaveIcon className="h-3.5 w-3.5 mr-1" />}
        Save Configuration
      </Button>
    </div>
  );
}

function RoomMappingTab({ password, username }: { password: string; username?: string }) {
  const { call: apiCall } = useChannelApi(password, username);
  const { showError } = useAdminToast();
  const [mappings, setMappings] = useState<RoomMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMapping, setNewMapping] = useState<Partial<RoomMapping>>({ dormId: 0, dormName: "", channelRoomCode: "", totalInventory: 0, isActive: 1 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/admin/channel-manager", { action: "getRoomMappings" });
      setMappings(res.mappings || []);
    } catch (e: any) { showError(e.message); }
    setLoading(false);
  };

  const save = async (mapping: Partial<RoomMapping>) => {
    try {
      await apiCall("/api/admin/channel-manager", { action: "saveRoomMapping", mapping });
      await load();
    } catch (e: any) { showError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this room mapping and all associated rate plans?")) return;
    try {
      await apiCall("/api/admin/channel-manager", { action: "deleteRoomMapping", id });
      await load();
    } catch (e: any) { showError(e.message); }
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Dorm → Aiosell Room Code Mapping</h3>
      <p className="text-xs text-muted-foreground">Map each dorm to its Aiosell room code. Total inventory = number of beds in that dorm.</p>

      {mappings.length > 0 && (
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
              <span className="font-medium flex-1">{m.dormName}</span>
              <code className="text-xs bg-background px-2 py-0.5 rounded">{m.channelRoomCode}</code>
              <span className="text-xs text-muted-foreground">{m.totalInventory} beds</span>
              <Button variant="ghost" size="sm" onClick={() => remove(m.id!)} className="h-7 w-7 p-0 text-red-500">
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium">Add Room Mapping</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input placeholder="Dorm ID" type="number" value={newMapping.dormId || ""} onChange={(e) => setNewMapping({ ...newMapping, dormId: parseInt(e.target.value) || 0 })} />
          <Input placeholder="Dorm Name" value={newMapping.dormName || ""} onChange={(e) => setNewMapping({ ...newMapping, dormName: e.target.value })} />
          <Input placeholder="Room Code" value={newMapping.channelRoomCode || ""} onChange={(e) => setNewMapping({ ...newMapping, channelRoomCode: e.target.value })} />
          <Input placeholder="Total Beds" type="number" value={newMapping.totalInventory || ""} onChange={(e) => setNewMapping({ ...newMapping, totalInventory: parseInt(e.target.value) || 0 })} />
        </div>
        <Button size="sm" onClick={() => { save(newMapping); setNewMapping({ dormId: 0, dormName: "", channelRoomCode: "", totalInventory: 0, isActive: 1 }); }} disabled={!newMapping.dormName || !newMapping.channelRoomCode}>
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function RatePlansTab({ password, username }: { password: string; username?: string }) {
  const { call: apiCall } = useChannelApi(password, username);
  const { showError } = useAdminToast();
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [mappings, setMappings] = useState<RoomMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlan, setNewPlan] = useState<Partial<RatePlan>>({ roomMappingId: 0, ratePlanCode: "", ratePlanName: "", isActive: 1 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, mappingsRes] = await Promise.all([
        apiCall("/api/admin/channel-manager", { action: "getRatePlans" }),
        apiCall("/api/admin/channel-manager", { action: "getRoomMappings" }),
      ]);
      setPlans(plansRes.plans || []);
      setMappings(mappingsRes.mappings || []);
    } catch (e: any) { showError(e.message); }
    setLoading(false);
  };

  const save = async (plan: Partial<RatePlan>) => {
    try {
      await apiCall("/api/admin/channel-manager", { action: "saveRatePlan", plan });
      await load();
    } catch (e: any) { showError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this rate plan and all associated daily rates?")) return;
    try {
      await apiCall("/api/admin/channel-manager", { action: "deleteRatePlan", id });
      await load();
    } catch (e: any) { showError(e.message); }
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Rate Plans</h3>
      <p className="text-xs text-muted-foreground">Each room type can have multiple rate plans (e.g., EP = room only, CP = with breakfast).</p>

      {plans.length > 0 && (
        <div className="space-y-2">
          {plans.map((p) => {
            const room = mappings.find((m) => m.id === p.roomMappingId);
            return (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                <span className="text-xs text-muted-foreground">{room?.dormName || "?"}</span>
                <span className="font-medium flex-1">{p.ratePlanName}</span>
                <code className="text-xs bg-background px-2 py-0.5 rounded">{p.ratePlanCode}</code>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id!)} className="h-7 w-7 p-0 text-red-500">
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium">Add Rate Plan</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            className="rounded-md border px-3 py-2 text-sm bg-background"
            value={newPlan.roomMappingId || 0}
            onChange={(e) => setNewPlan({ ...newPlan, roomMappingId: parseInt(e.target.value) || 0 })}
          >
            <option value={0}>Select Room...</option>
            {mappings.map((m) => <option key={m.id} value={m.id}>{m.dormName} ({m.channelRoomCode})</option>)}
          </select>
          <Input placeholder="Rate Plan Code" value={newPlan.ratePlanCode || ""} onChange={(e) => setNewPlan({ ...newPlan, ratePlanCode: e.target.value })} />
          <Input placeholder="Rate Plan Name" value={newPlan.ratePlanName || ""} onChange={(e) => setNewPlan({ ...newPlan, ratePlanName: e.target.value })} />
        </div>
        <Button size="sm" onClick={() => { save(newPlan); setNewPlan({ roomMappingId: 0, ratePlanCode: "", ratePlanName: "", isActive: 1 }); }} disabled={!newPlan.roomMappingId || !newPlan.ratePlanCode || !newPlan.ratePlanName}>
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function SyncTab({ password, username }: { password: string; username?: string }) {
  const { call: apiCall } = useChannelApi(password, username);
  const { showError } = useAdminToast();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<string | null>(null);

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiCall("/api/admin/channel-manager", { action: "getSyncLogs", limit: 30 });
      setLogs(res.logs || []);
    } catch (e: any) { showError(e.message); }
    setLoading(false);
  };

  const pushAction = async (type: string, url: string, extra?: Record<string, unknown>) => {
    setPushing(type);
    try {
      const res = await apiCall(url, extra || {});
      if (res.success || res.pushed) {
        showError(`${type} push completed`);
      } else {
        showError(res.error || res.message || "Push failed");
      }
      await loadLogs();
    } catch (e: any) { showError(e.message); }
    setPushing(null);
  };

  if (loading) return <AdminLoading />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Push to Aiosell</h3>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => pushAction("Inventory", "/api/aiosell/push-inventory")} disabled={!!pushing}>
          {pushing === "Inventory" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin mr-1" /> : <SendIcon className="h-3.5 w-3.5 mr-1" />}
          Push Inventory
        </Button>
        <Button size="sm" onClick={() => pushAction("Rates", "/api/aiosell/push-rates", { includeRestrictions: true })} disabled={!!pushing}>
          {pushing === "Rates" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin mr-1" /> : <SendIcon className="h-3.5 w-3.5 mr-1" />}
          Push Rates + Restrictions
        </Button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-semibold">Sync Log</h3>
        <Button variant="ghost" size="sm" onClick={loadLogs}>
          <RefreshCwIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Full request/response JSON: Management → Logs → PMS</p>

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sync activity yet.</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
              <span className={cn("w-2 h-2 rounded-full", log.status === "success" ? "bg-green-500" : "bg-red-500")} />
              <span className="font-mono text-muted-foreground w-14">{log.direction}</span>
              <span className="font-medium w-20">{log.type}</span>
              <span className="flex-1 text-muted-foreground truncate">{log.errorMessage || `${log.recordsAffected} records`}</span>
              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
