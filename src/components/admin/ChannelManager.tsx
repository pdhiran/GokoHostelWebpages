"use client";

import { useState, useEffect } from "react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminLoading } from "./AdminLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  RefreshCwIcon, SaveIcon, PlusIcon, Trash2Icon, PencilIcon,
  CheckCircleIcon, XCircleIcon, Loader2Icon, WifiIcon, SendIcon,
} from "lucide-react";
import { suggestAiosellRoomCode } from "@/lib/channelMapping";
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
  const { showError, showSuccess } = useAdminToast();
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
      showSuccess("Configuration saved");
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
          <label className="text-xs text-muted-foreground">Webhook Secret (required to enable)</label>
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
  const [dorms, setDorms] = useState<Array<{ id: number; name: string; bedCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingDormId, setSavingDormId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { code: string; beds: number }>>({});

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiCall("/api/admin/channel-manager", { action: "getRoomMappings" });
      setMappings(res.mappings || []);
      setDorms(res.dorms || []);
    } catch (e: any) { showError(e.message); }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const draftFor = (dormId: number, fallbackCode: string, fallbackBeds: number) =>
    drafts[dormId] ?? { code: fallbackCode, beds: fallbackBeds };

  const setDraft = (dormId: number, patch: Partial<{ code: string; beds: number }>, fallbackCode: string, fallbackBeds: number) => {
    setDrafts((prev) => {
      const cur = prev[dormId] ?? { code: fallbackCode, beds: fallbackBeds };
      return { ...prev, [dormId]: { ...cur, ...patch } };
    });
  };

  const saveDorm = async (dormId: number, mappingId: number | undefined, fallbackCode: string, fallbackBeds: number) => {
    const d = draftFor(dormId, fallbackCode, fallbackBeds);
    const code = d.code.trim();
    if (!code) { showError("Aiosell room code is required"); return; }
    setSavingDormId(dormId);
    try {
      await apiCall("/api/admin/channel-manager", {
        action: "saveRoomMapping",
        mapping: {
          id: mappingId,
          dormId,
          channelRoomCode: code,
          totalInventory: d.beds,
          isActive: 1,
        },
      });
      setEditingId(null);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[dormId];
        return next;
      });
      await load(true);
    } catch (e: any) { showError(e.message); }
    setSavingDormId(null);
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this room mapping and all associated rate plans?")) return;
    try {
      await apiCall("/api/admin/channel-manager", { action: "deleteRoomMapping", id });
      if (editingId === id) setEditingId(null);
      await load(true);
    } catch (e: any) { showError(e.message); }
  };

  if (loading) return <AdminLoading />;

  const mappedByDorm = new Map(mappings.map((m) => [m.dormId, m]));
  const knownDormIds = new Set(dorms.map((d) => d.id));
  const orphans = mappings.filter((m) => !knownDormIds.has(m.dormId));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Room mapping</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Every Goko dorm (Management → Dorms) is listed here. New dorms show up on their own as unmapped. Aiosell only understands the room code you set — inventory and rates are pushed with that code, not the dorm name.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} title="Refresh dorms">
          <RefreshCwIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      <dl className="grid gap-2 rounded-lg border border-brand-mist bg-muted/30 p-3 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-medium text-foreground">Dorm</dt>
          <dd>From Management → Dorms. New dorms appear here automatically; they are not pushed to Aiosell until you save a room code.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Aiosell room code</dt>
          <dd>Exact room-type code in Aiosell (e.g. <code className="text-[10px]">dorm-1</code>, <code className="text-[10px]">shiva-dorm</code>, <code className="text-[10px]">executive</code>). Must match their setup.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Total beds</dt>
          <dd>Sellable inventory for that room type. Defaults to the dorm’s current bed count.</dd>
        </div>
      </dl>

      <div className="space-y-2">
        {dorms.length === 0 && (
          <p className="text-xs text-muted-foreground">No dorms yet. Add one under Management → Dorms.</p>
        )}
        {dorms.map((d) => {
          const mapping = mappedByDorm.get(d.id);
          const suggested = suggestAiosellRoomCode(d.name, d.id);
          if (!mapping) {
            const draft = draftFor(d.id, suggested, d.bedCount);
            return (
              <div key={d.id} className="flex flex-col gap-2 rounded-lg border border-dashed border-brand-mist p-2 sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">Not mapped — not sent to Aiosell yet</p>
                </div>
                <Input
                  className="sm:w-40"
                  placeholder="Aiosell room code"
                  value={draft.code}
                  onChange={(e) => setDraft(d.id, { code: e.target.value }, suggested, d.bedCount)}
                />
                <Input
                  className="sm:w-20"
                  type="number"
                  min={0}
                  value={draft.beds}
                  onChange={(e) => setDraft(d.id, { beds: parseInt(e.target.value) || 0 }, suggested, d.bedCount)}
                />
                <Button
                  size="sm"
                  disabled={savingDormId === d.id || !draft.code.trim()}
                  onClick={() => saveDorm(d.id, undefined, suggested, d.bedCount)}
                >
                  {savingDormId === d.id ? <Loader2Icon className="h-3.5 w-3.5 animate-spin mr-1" /> : <PlusIcon className="h-3.5 w-3.5 mr-1" />}
                  Map
                </Button>
              </div>
            );
          }

          const editing = editingId === mapping.id;
          const draft = draftFor(d.id, mapping.channelRoomCode, mapping.totalInventory);
          return (
            <div key={d.id} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2 sm:flex-row sm:items-center">
              <span className="flex-1 text-sm font-medium">{d.name}</span>
              {editing ? (
                <>
                  <Input
                    className="sm:w-40"
                    value={draft.code}
                    onChange={(e) => setDraft(d.id, { code: e.target.value }, mapping.channelRoomCode, mapping.totalInventory)}
                  />
                  <Input
                    className="sm:w-20"
                    type="number"
                    min={0}
                    value={draft.beds}
                    onChange={(e) => setDraft(d.id, { beds: parseInt(e.target.value) || 0 }, mapping.channelRoomCode, mapping.totalInventory)}
                  />
                  <Button size="sm" disabled={savingDormId === d.id} onClick={() => saveDorm(d.id, mapping.id, mapping.channelRoomCode, mapping.totalInventory)}>
                    {savingDormId === d.id ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <SaveIcon className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDrafts((p) => { const n = { ...p }; delete n[d.id]; return n; }); }}>Cancel</Button>
                </>
              ) : (
                <>
                  <code className="text-xs bg-background px-2 py-0.5 rounded">{mapping.channelRoomCode}</code>
                  <span className="text-xs text-muted-foreground">{mapping.totalInventory} beds</span>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(mapping.id!)} className="h-7 w-7 p-0" title="Edit">
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(mapping.id!)} className="h-7 w-7 p-0 text-red-500" title="Delete">
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
        {orphans.map((m) => (
          <div key={`orphan-${m.id}`} className="flex items-center gap-2 rounded-lg border border-red-200 p-2 text-sm">
            <span className="flex-1 font-medium">{m.dormName}</span>
            <span className="text-[10px] text-red-600">Dorm deleted</span>
            <code className="text-xs bg-background px-2 py-0.5 rounded">{m.channelRoomCode}</code>
            <Button variant="ghost" size="sm" onClick={() => remove(m.id!)} className="h-7 w-7 p-0 text-red-500" title="Delete">
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
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
      setNewPlan({ roomMappingId: 0, ratePlanCode: "", ratePlanName: "", isActive: 1 });
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
      <p className="text-xs text-muted-foreground">Each mapped room type can have multiple rate plans (e.g., EP = room only, CP = with breakfast).</p>
      {mappings.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Map a dorm under Room Mapping first — unmapped dorms cannot have rate plans.</p>
      )}

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
        <Button size="sm" onClick={() => save(newPlan)} disabled={!newPlan.roomMappingId || !newPlan.ratePlanCode || !newPlan.ratePlanName}>
          <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

function SyncTab({ password, username }: { password: string; username?: string }) {
  const { call: apiCall } = useChannelApi(password, username);
  const { showError, showSuccess } = useAdminToast();
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
        showSuccess(`${type} push completed`);
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
