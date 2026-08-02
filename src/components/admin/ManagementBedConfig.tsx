"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Loader2Icon, SaveIcon } from "lucide-react";

type BedConfig = { id: number; dormId: number; bedType: string; maxOccupancy: number; extraPersonAllowed: number };
type Dorm = { id: number; name: string };

export function ManagementBedConfig({ password, username }: { password: string; username?: string }) {
  const [configs, setConfigs] = useState<BedConfig[]>([]);
  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [addDormId, setAddDormId] = useState<number>(0);
  const [addBedType, setAddBedType] = useState("Bunk");
  const [addOcc, setAddOcc] = useState(1);
  const [addExtra, setAddExtra] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, gridRes] = await Promise.all([
        fetch("/api/admin/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, username, action: "getBedTypeConfigs" }) }),
        fetch("/api/admin/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, username, action: "getInventoryGrid", startDate: "2026-01-01", endDate: "2026-01-02" }) }),
      ]);
      const configData = await configRes.json();
      const gridData = await gridRes.json();
      setConfigs(configData.configs || []);
      setDorms(gridData.dorms || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (config: BedConfig) => {
    setSaving(config.id);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "upsertBedTypeConfig", id: config.id, dormId: config.dormId, bedType: config.bedType, maxOccupancy: config.maxOccupancy, extraPersonAllowed: config.extraPersonAllowed }),
      });
      const data = await res.json();
      if (data.configs) setConfigs(data.configs);
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!addDormId) return;
    setSaving(-1);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "upsertBedTypeConfig", dormId: addDormId, bedType: addBedType, maxOccupancy: addOcc, extraPersonAllowed: addExtra }),
      });
      const data = await res.json();
      if (data.configs) setConfigs(data.configs);
      setAddDormId(0);
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = (id: number, field: string, value: any) => {
    setConfigs(configs.map((c) => c.id === id ? { ...c, [field]: value } : c));
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2Icon className="h-5 w-5 animate-spin text-brand-green" /></div>;

  const dormsWithoutConfig = dorms.filter((d) => !configs.some((c) => c.dormId === d.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-green-dark/60 dark:text-zinc-400">
        Configure occupancy settings per dorm. This determines which rate fields (Adult 1, Adult 2, Extra Person) are shown when editing rates.
      </p>

      <div className="rounded-xl border border-brand-mist bg-white dark:bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-mist bg-brand-sand/30 dark:bg-zinc-800/30">
              <th className="px-4 py-2 text-left font-medium text-brand-green-dark/60">Dorm</th>
              <th className="px-4 py-2 text-left font-medium text-brand-green-dark/60">Bed Type</th>
              <th className="px-4 py-2 text-center font-medium text-brand-green-dark/60">Max Occupancy</th>
              <th className="px-4 py-2 text-center font-medium text-brand-green-dark/60">Extra Person</th>
              <th className="px-4 py-2 text-right font-medium text-brand-green-dark/60">Save</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => {
              const dorm = dorms.find((d) => d.id === config.dormId);
              return (
                <tr key={config.id} className="border-b border-brand-mist/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-brand-green-dark dark:text-zinc-200">{dorm?.name || `Dorm #${config.dormId}`}</td>
                  <td className="px-4 py-2.5">
                    <select className="rounded border border-input bg-background px-2 py-1 text-xs" value={config.bedType} onChange={(e) => updateConfig(config.id, "bedType", e.target.value)}>
                      <option value="Bunk">Bunk</option>
                      <option value="Single">Single</option>
                      <option value="Double">Double</option>
                      <option value="Bunk2L1U">Bunk2L1U</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <select className="rounded border border-input bg-background px-2 py-1 text-xs" value={config.maxOccupancy} onChange={(e) => updateConfig(config.id, "maxOccupancy", Number(e.target.value))}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button type="button" onClick={() => updateConfig(config.id, "extraPersonAllowed", config.extraPersonAllowed ? 0 : 1)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${config.extraPersonAllowed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {config.extraPersonAllowed ? "Yes" : "No"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleSave(config)} disabled={saving === config.id}>
                      {saving === config.id ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <SaveIcon className="h-3.5 w-3.5" />}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dormsWithoutConfig.length > 0 && (
        <div className="flex items-end gap-2 p-3 rounded-lg border border-dashed border-brand-mist">
          <div className="flex-1">
            <label className="text-xs font-medium text-brand-green-dark/60">Add Config for Dorm</label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={addDormId} onChange={(e) => setAddDormId(Number(e.target.value))}>
              <option value={0}>Select dorm</option>
              {dormsWithoutConfig.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-brand-green-dark/60">Bed Type</label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={addBedType} onChange={(e) => setAddBedType(e.target.value)}>
              <option value="Bunk">Bunk</option>
              <option value="Single">Single</option>
              <option value="Double">Double</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-brand-green-dark/60">Max Occ.</label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={addOcc} onChange={(e) => setAddOcc(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
          <Button variant="cta" size="sm" onClick={handleAdd} disabled={saving === -1 || !addDormId} className="gap-1">
            <PlusIcon className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
