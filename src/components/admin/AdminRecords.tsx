"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLinkIcon, Trash2Icon, PlusIcon, UploadIcon, PencilIcon, ShieldCheckIcon, ShieldAlertIcon, Loader2Icon, XIcon, FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminApi } from "./useAdminApi";
import { AdminLoading } from "./AdminLoading";
import { CHECKIN_COLUMNS, type Role } from "./types";
import { countries } from "@/content/countries";
import { BOOKING_PLATFORMS } from "@/lib/checkinSchema";

const TEXT_FIELDS = [
  { index: 1, label: "Arrival Date", type: "date" },
  { index: 2, label: "Arrival Time", type: "time" },
  { index: 3, label: "Name", type: "text" },
  { index: 4, label: "Persons", type: "text" },
  { index: 5, label: "Contact", type: "tel" },
  { index: 6, label: "Days", type: "text" },
  { index: 7, label: "Coming From", type: "text" },
  { index: 8, label: "Nationality", type: "country" },
  { index: 9, label: "Emergency Contact", type: "text" },
  { index: 10, label: "Emergency Phone", type: "tel" },
  { index: 13, label: "ID Type", type: "select", options: ["aadhaar", "driving_licence", "passport"] },
];

const FORM_C_FIELDS = [
  { key: "arrivedFromCountry", label: "Arrived from Country", type: "country" },
  { key: "arrivedFromCity", label: "Arrived from City", type: "text" },
  { key: "arrivedFromPlace", label: "Arrived from Place", type: "text" },
  { key: "dateOfArrivalInIndia", label: "Date of Arrival in India", type: "date" },
  { key: "purposeOfVisit", label: "Purpose of Visit", type: "select", options: ["Tourism", "Business", "Medical", "Education", "Employment", "Conference", "Research", "Transit", "Others"] },
  { key: "employedInIndia", label: "Employed in India?", type: "select", options: ["No", "Yes"] },
  { key: "nextDestination", label: "Next Destination", type: "select", options: ["Inside India", "Outside India"] },
  { key: "nextDestState", label: "Next Dest. State", type: "text" },
  { key: "nextDestCity", label: "Next Dest. City", type: "text" },
  { key: "homeAddress", label: "Home Country Address", type: "text" },
  { key: "homeCity", label: "Home City", type: "text" },
  { key: "homeCountryPhone", label: "Home Country Phone", type: "tel" },
];

function getDefaults(): string[] {
  const arr = Array(17).fill("");
  const now = new Date();
  arr[1] = now.toISOString().split("T")[0];
  arr[2] = now.toTimeString().slice(0, 5);
  arr[8] = "India";
  return arr;
}

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([^/]+)\//);
  return match ? match[1] : null;
}

export function AdminRecords({ password, username, role }: { password: string; username?: string; role: Role }) {
  const { apiCall } = useAdminApi(password, username);
  const [rows, setRows] = useState<string[][]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState<string[]>(getDefaults());
  const [newIdFiles, setNewIdFiles] = useState<File[]>([]);
  const [showPastForm, setShowPastForm] = useState(false);
  const [pastEntry, setPastEntry] = useState<string[]>(getDefaults());
  const [pastIdFiles, setPastIdFiles] = useState<File[]>([]);
  const [pastCheckoutDate, setPastCheckoutDate] = useState("");
  const [newFormCFields, setNewFormCFields] = useState<Record<string, string>>({});
  const [pastFormCFields, setPastFormCFields] = useState<Record<string, string>>({});
  const [newBookingPlatform, setNewBookingPlatform] = useState("");
  const [newBookingId, setNewBookingId] = useState("");
  const [pastBookingPlatform, setPastBookingPlatform] = useState("");
  const [pastBookingId, setPastBookingId] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<string[]>(Array(17).fill(""));
  const [editIdFiles, setEditIdFiles] = useState<File[]>([]);
  const [editVisaFiles, setEditVisaFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "place" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [verifyPopup, setVerifyPopup] = useState<{ origIdx: number; row: string[] } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [uploadPopup, setUploadPopup] = useState<{ origIdx: number; type: "id" | "visa"; guestName: string } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadIdType, setUploadIdType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formCPopup, setFormCPopup] = useState<{ origIdx: number; row: string[]; data: any } | null>(null);
  const [formCLoading, setFormCLoading] = useState(false);
  const [formCEditing, setFormCEditing] = useState(false);
  const [formCEditData, setFormCEditData] = useState<Record<string, any>>({});
  const [formCSaving, setFormCSaving] = useState(false);
  const [frroUsername, setFrroUsername] = useState("");
  const [frroPassword, setFrroPassword] = useState("");
  const [frroSettingsOpen, setFrroSettingsOpen] = useState(false);
  const [frroSubmitting, setFrroSubmitting] = useState(false);
  const [frroStatus, setFrroStatus] = useState("");

  const filteredRows = (() => {
    let result = [...rows].map((row, origIdx) => ({ row, origIdx }));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(({ row }) => row.some((cell) => cell?.toLowerCase().includes(q)));
    }
    if (sortField === "date") {
      result.sort((a, b) => {
        const dateA = a.row[1] || ""; const dateB = b.row[1] || "";
        return sortDir === "asc" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      });
    } else if (sortField === "place") {
      result.sort((a, b) => {
        const placeA = (a.row[7] || "").toLowerCase(); const placeB = (b.row[7] || "").toLowerCase();
        return sortDir === "asc" ? placeA.localeCompare(placeB) : placeB.localeCompare(placeA);
      });
    }
    return result;
  })();

  const hasActiveFilters = searchQuery.trim() !== "" || sortField !== null;
  const clearFilters = () => { setSearchQuery(""); setSortField(null); setSortDir("desc"); };

  const loadTab = async (tab?: string) => {
    setLoading(true);
    try {
      const res = await apiCall({ action: "list", month: tab });
      if (res.ok) {
        const data = await res.json();
        const allRows: string[][] = data.rows || [];
        setRows(allRows.filter((r) => r.some((cell) => cell && cell.trim() !== "")));
        const hiddenTabs = ["CheckIns", "Settings", "Dorms", "BedHistory", "ApiStats"];
        setTabs((data.tabs || []).filter((t: string) => !hiddenTabs.includes(t)));
        setCurrentTab(data.currentTab || "");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTab(); }, []);

  const refresh = () => loadTab(currentTab);

  const deleteRow = async (rowIndex: number) => {
    if (!confirm("Delete this entry and its documents?")) return;
    setLoading(true);
    try {
      const row = rows[rowIndex];
      const rowId = parseInt(row[17] || "0", 10);
      const driveFileIds: string[] = [];
      [row[14], row[15]].forEach((cell) => {
        if (cell) cell.split(" | ").forEach((url) => {
          if (url.startsWith("http")) { const id = extractDriveFileId(url); if (id) driveFileIds.push(id); }
        });
      });
      const guestName = row[3] || "";
      const res = await apiCall({ action: "delete", rowId, driveFileIds, guestName });
      if (res.ok) setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    } finally { setLoading(false); }
  };

  const startEdit = (rowIndex: number) => {
    const padded = Array(17).fill("").map((_, i) => rows[rowIndex][i] || "");
    setEditEntry(padded);
    setEditIndex(rowIndex);
    setEditIdFiles([]);
    setEditVisaFiles([]);
  };

  const updateRow = async () => {
    if (editIndex === null) return;
    setLoading(true);
    try {
      const updated = [...editEntry];
      const doUpload = async (files: File[], guestName: string, type: string) => {
        const links: string[] = [];
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file); fd.append("name", guestName); fd.append("type", type); fd.append("password", password);
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
          if (res.ok) { const data = await res.json(); if (data.link) links.push(data.link); }
          else { alert(`File upload failed (${res.status}): ${await res.text()}`); }
        }
        return links.join(" | ");
      };
      if (editIdFiles.length > 0) updated[14] = await doUpload(editIdFiles, updated[3] || "Guest", "id");
      if (editVisaFiles.length > 0) updated[15] = await doUpload(editVisaFiles, updated[3] || "Guest", "visa");
      const rowId = parseInt(rows[editIndex!][17] || "0", 10);
      const res = await apiCall({ action: "update", rowId, entry: updated, tab: currentTab });
      if (res.ok) { setEditIndex(null); refresh(); }
    } finally { setLoading(false); }
  };

  const addEntry = async () => {
    if (!newEntry[3]) { alert("Name is required"); return; }
    setLoading(true);
    try {
      const entry = [...newEntry]; entry[0] = new Date().toISOString();

      if (newIdFiles.length > 0) {
        const links: string[] = [];
        for (const file of newIdFiles) {
          const fd = new FormData();
          fd.append("file", file); fd.append("name", entry[3] || "Guest"); fd.append("type", "id"); fd.append("password", password);
          try {
            const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data.link) links.push(data.link);
            } else {
              const errText = await uploadRes.text();
              alert(`File upload failed: ${errText}. Entry will be saved without ID document.`);
            }
          } catch (err: any) {
            alert(`File upload error: ${err?.message || "Network error"}. Entry will be saved without ID document.`);
          }
        }
        if (links.length > 0) entry[14] = links.join(" | ");
      }

      const isForeigner = newEntry[8] && newEntry[8] !== "India";
      const formCData = isForeigner ? JSON.stringify(newFormCFields) : undefined;
      const res = await apiCall({ action: "add", entry, formCData, bookingPlatform: newBookingPlatform, bookingId: newBookingId });
      if (res.ok) { setShowAddForm(false); setNewEntry(getDefaults()); setNewIdFiles([]); setNewFormCFields({}); setNewBookingPlatform(""); setNewBookingId(""); refresh(); }
    } finally { setLoading(false); }
  };

  const addPastEntry = async () => {
    if (!pastEntry[3]) { alert("Name is required"); return; }
    if (!pastEntry[1]) { alert("Arrival date is required for past records"); return; }
    if (pastCheckoutDate && pastCheckoutDate < pastEntry[1]) { alert("Checkout date must be on or after arrival date"); return; }
    setLoading(true);
    try {
      const entry = [...pastEntry]; entry[0] = new Date().toISOString();

      if (pastIdFiles.length > 0) {
        const links: string[] = [];
        for (const file of pastIdFiles) {
          const fd = new FormData();
          fd.append("file", file); fd.append("name", entry[3] || "Guest"); fd.append("type", "id"); fd.append("password", password);
          try {
            const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data.link) links.push(data.link);
            } else {
              const errText = await uploadRes.text();
              alert(`File upload failed: ${errText}. Entry will be saved without ID document.`);
            }
          } catch (err: any) {
            alert(`File upload error: ${err?.message || "Network error"}. Entry will be saved without ID document.`);
          }
        }
        if (links.length > 0) entry[14] = links.join(" | ");
      }

      const isForeigner = pastEntry[8] && pastEntry[8] !== "India";
      const formCData = isForeigner ? JSON.stringify(pastFormCFields) : undefined;
      const res = await apiCall({ action: "addPast", entry, checkoutDate: pastCheckoutDate, formCData, bookingPlatform: pastBookingPlatform, bookingId: pastBookingId });
      if (res.ok) { setShowPastForm(false); setPastEntry(getDefaults()); setPastIdFiles([]); setPastCheckoutDate(""); setPastFormCFields({}); setPastBookingPlatform(""); setPastBookingId(""); refresh(); }
      else { const errData = await res.json().catch(() => ({})); alert(errData.error || "Failed to save past record"); }
    } finally { setLoading(false); }
  };

  const undoCheckout = async (origIdx: number) => {
    if (!confirm("Re-activate this guest? They will appear in the 'unassigned beds' list.")) return;
    setLoading(true);
    try {
      const checkinId = parseInt(rows[origIdx][17] || "0", 10);
      const res = await apiCall({ action: "undoCheckout", checkinId });
      if (res.ok) refresh();
      else { const d = await res.json(); alert(d.error || "Failed"); }
    } finally { setLoading(false); }
  };

  const verifyManually = async (origIdx: number, verified: boolean) => {
    setVerifying(true);
    try {
      const rowId = parseInt(rows[origIdx][17] || "0", 10);
      const res = await apiCall({ action: "verifyCheckin", rowId, verified });
      if (res.ok) { setVerifyPopup(null); refresh(); }
    } finally { setVerifying(false); }
  };

  const handleInlineUpload = async () => {
    if (!uploadPopup || uploadFiles.length === 0) return;
    if (uploadPopup.type === "id" && !uploadIdType) { alert("Please select ID type"); return; }
    setUploading(true);
    try {
      const links: string[] = [];
      for (const file of uploadFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", uploadPopup.guestName || "Guest");
        fd.append("type", uploadPopup.type);
        fd.append("password", password);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data.link) links.push(data.link);
        } else {
          const errText = await res.text();
          alert(`Upload failed (${res.status}): ${errText}`);
        }
      }
      if (links.length > 0) {
        const updated = Array(17).fill("").map((_, i) => rows[uploadPopup.origIdx][i] || "");
        if (uploadPopup.type === "id") {
          updated[14] = links.join(" | ");
          if (uploadIdType) updated[13] = uploadIdType;
        } else {
          updated[15] = links.join(" | ");
        }
        const rowId = parseInt(rows[uploadPopup.origIdx][17] || "0", 10);
        const updateRes = await apiCall({ action: "update", rowId, entry: updated, tab: currentTab });
        if (!updateRes.ok) {
          const errData = await updateRes.json();
          alert(`Record update failed: ${errData.error || "Unknown error"}`);
        }
      } else if (uploadFiles.length > 0) {
        alert("All file uploads failed. Please try again.");
      }
      setUploadPopup(null);
      setUploadFiles([]);
      setUploadIdType("");
      refresh();
    } finally { setUploading(false); }
  };

  const openFormC = async (origIdx: number, row: string[]) => {
    setFormCLoading(true);
    setFrroStatus("");
    setFormCEditing(false);
    try {
      const rowId = parseInt(row[17] || "0", 10);
      const res = await apiCall({ action: "getFormCData", rowId });
      if (res.ok) {
        const d = await res.json();
        setFormCPopup({ origIdx, row, data: d.formCData ? JSON.parse(d.formCData) : {} });
      } else {
        setFormCPopup({ origIdx, row, data: {} });
      }
      const userRes = await apiCall({ action: "getSetting", key: "frro_username" });
      if (userRes.ok) { const ud = await userRes.json(); setFrroUsername(ud.value || ""); }
      const passRes = await apiCall({ action: "getSetting", key: "frro_password" });
      if (passRes.ok) { const pd = await passRes.json(); setFrroPassword(pd.value || ""); }
    } catch {
      setFormCPopup({ origIdx, row, data: {} });
    } finally {
      setFormCLoading(false);
    }
  };

  if (loading && rows.length === 0) {
    return <AdminLoading message="Loading records..." />;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold text-brand-green md:text-2xl">Check-in Records</h2>
        <div className="flex gap-2">
          <Button type="button" variant="ctaOutline" onClick={() => { setShowAddForm(true); setShowPastForm(false); }} disabled={loading}>
            <PlusIcon className="mr-1 h-4 w-4" /> Add
          </Button>
          <Button type="button" variant="ctaOutline" onClick={() => { setShowPastForm(true); setShowAddForm(false); }} disabled={loading}>
            <PlusIcon className="mr-1 h-4 w-4" /> Past
          </Button>
          <Button type="button" variant="ctaOutline" onClick={refresh} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Month tabs */}
      {tabs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => loadTab(tab)}
              className={cn("rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                tab === currentTab ? "bg-brand-green text-white" : "bg-white text-brand-green-dark/70 hover:bg-brand-green/[0.06]"
              )}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-xs" />
          <select value={sortField || ""} onChange={(e) => setSortField(e.target.value ? e.target.value as any : null)} className="rounded-md border border-input bg-background px-3 py-2 text-xs">
            <option value="">Sort by...</option>
            <option value="date">Date</option>
            <option value="place">Coming from</option>
          </select>
          {sortField && <button type="button" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")} className="rounded-md border border-input bg-background px-2 py-2 text-xs">{sortDir === "asc" ? "A-Z" : "Z-A"}</button>}
          {hasActiveFilters && <button type="button" onClick={clearFilters} className="rounded-md bg-brand-red/10 px-3 py-2 text-xs font-medium text-brand-red hover:bg-brand-red/20">Clear</button>}
        </div>
        <p className="text-sm text-brand-green-dark/70">{filteredRows.length}{filteredRows.length !== rows.length ? ` of ${rows.length}` : ""} records</p>
      </div>

      {/* Add entry form */}
      {showAddForm && (
        <div className="mt-4 rounded-2xl border border-brand-mist bg-white p-6 shadow-card">
          <h3 className="font-display text-lg font-bold text-brand-green">Add manual entry</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {TEXT_FIELDS.map((field) => (
              <div key={field.index}>
                <Label className="text-xs">{field.label}</Label>
                {field.type === "select" ? (
                  <select value={newEntry[field.index]} onChange={(e) => { const u = [...newEntry]; u[field.index] = e.target.value; setNewEntry(u); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {field.options!.map((opt) => <option key={opt} value={opt}>{opt.replace("_", " ")}</option>)}
                  </select>
                ) : field.type === "country" ? (
                  <select value={newEntry[field.index]} onChange={(e) => { const u = [...newEntry]; u[field.index] = e.target.value; setNewEntry(u); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <Input type={field.type} value={newEntry[field.index]} onChange={(e) => { const u = [...newEntry]; u[field.index] = e.target.value; setNewEntry(u); }} placeholder={field.label} className="mt-1" />
                )}
              </div>
            ))}
            <div className="sm:col-span-2 md:col-span-3 rounded-lg border border-brand-mist bg-brand-sand/20 p-3">
              <p className="mb-2 text-xs font-semibold text-brand-green-dark">Booking details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Booking Platform</Label>
                  <select value={newBookingPlatform} onChange={(e) => { setNewBookingPlatform(e.target.value); if (e.target.value === "Offline booking" || e.target.value === "Walk-in") setNewBookingId(""); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {BOOKING_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {newBookingPlatform && newBookingPlatform !== "Offline booking" && newBookingPlatform !== "Walk-in" && (
                  <div>
                    <Label className="text-xs">Booking ID</Label>
                    <Input value={newBookingId} onChange={(e) => setNewBookingId(e.target.value)} placeholder="e.g. 4829173650" className="mt-1" />
                  </div>
                )}
                {(newBookingPlatform === "Offline booking" || newBookingPlatform === "Walk-in") && (
                  <div className="flex items-end">
                    <p className="pb-2 text-xs text-brand-green-dark/50">Booking ID will be auto-generated</p>
                  </div>
                )}
              </div>
            </div>
            {newEntry[8] && newEntry[8] !== "India" && (
              <div className="sm:col-span-2 md:col-span-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
                <p className="mb-2 text-xs font-semibold text-blue-800">Form C fields (foreign guest)</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {FORM_C_FIELDS.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === "select" ? (
                        <select value={newFormCFields[f.key] || ""} onChange={(e) => setNewFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {f.options!.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : f.type === "country" ? (
                        <select value={newFormCFields[f.key] || ""} onChange={(e) => setNewFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <Input type={f.type} value={newFormCFields[f.key] || ""} onChange={(e) => setNewFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className="mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="sm:col-span-2 md:col-span-3">
              <Label className="text-xs">ID Card photos</Label>
              {newIdFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {newIdFiles.map((file, i) => (
                    <div key={i} className="relative">
                      {file.type === "application/pdf" ? (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-brand-mist bg-brand-sand/30 text-xs font-medium text-brand-green-dark/60">PDF</div>
                      ) : (
                        <img src={URL.createObjectURL(file)} alt={`ID ${i + 1}`} className="h-20 w-20 rounded-lg border border-brand-mist object-cover" />
                      )}
                      <button type="button" onClick={() => setNewIdFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600">
                        <XIcon className="h-3 w-3" />
                      </button>
                      <p className="mt-1 max-w-[80px] truncate text-center text-[10px] text-brand-green-dark/50">{i === 0 ? "Front" : i === 1 ? "Back" : `Page ${i + 1}`}</p>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-brand-sand/50">
                <UploadIcon className="h-4 w-4 text-brand-green" />
                {newIdFiles.length === 0 ? "Choose files" : "Add more photos"}
                <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setNewIdFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
              </label>
              {newIdFiles.length > 0 && (
                <p className="mt-1 text-[10px] text-brand-green-dark/50">{newIdFiles.length} file(s) — upload front & back of ID</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="cta" onClick={addEntry} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Past check-in form */}
      {showPastForm && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/30 p-6 shadow-card">
          <h3 className="font-display text-lg font-bold text-amber-800">Add past check-in record</h3>
          <p className="mt-1 text-xs text-amber-700">This record is for archival purposes only — no bed assignment needed.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {TEXT_FIELDS.map((field) => (
              <div key={field.index}>
                <Label className="text-xs">{field.label}</Label>
                {field.type === "select" ? (
                  <select value={pastEntry[field.index]} onChange={(e) => { const u = [...pastEntry]; u[field.index] = e.target.value; setPastEntry(u); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {field.options!.map((opt) => <option key={opt} value={opt}>{opt.replace("_", " ")}</option>)}
                  </select>
                ) : field.type === "country" ? (
                  <select value={pastEntry[field.index]} onChange={(e) => { const u = [...pastEntry]; u[field.index] = e.target.value; setPastEntry(u); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <Input type={field.type} value={pastEntry[field.index]} onChange={(e) => { const u = [...pastEntry]; u[field.index] = e.target.value; setPastEntry(u); }} placeholder={field.label} className="mt-1" />
                )}
              </div>
            ))}
            <div>
              <Label className="text-xs">Checkout Date</Label>
              <Input type="date" value={pastCheckoutDate} onChange={(e) => setPastCheckoutDate(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2 md:col-span-3 rounded-lg border border-brand-mist bg-brand-sand/20 p-3">
              <p className="mb-2 text-xs font-semibold text-brand-green-dark">Booking details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Booking Platform</Label>
                  <select value={pastBookingPlatform} onChange={(e) => { setPastBookingPlatform(e.target.value); if (e.target.value === "Offline booking" || e.target.value === "Walk-in") setPastBookingId(""); }} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {BOOKING_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {pastBookingPlatform && pastBookingPlatform !== "Offline booking" && pastBookingPlatform !== "Walk-in" && (
                  <div>
                    <Label className="text-xs">Booking ID</Label>
                    <Input value={pastBookingId} onChange={(e) => setPastBookingId(e.target.value)} placeholder="e.g. 4829173650" className="mt-1" />
                  </div>
                )}
                {(pastBookingPlatform === "Offline booking" || pastBookingPlatform === "Walk-in") && (
                  <div className="flex items-end">
                    <p className="pb-2 text-xs text-brand-green-dark/50">Booking ID will be auto-generated</p>
                  </div>
                )}
              </div>
            </div>
            {pastEntry[8] && pastEntry[8] !== "India" && (
              <div className="sm:col-span-2 md:col-span-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
                <p className="mb-2 text-xs font-semibold text-blue-800">Form C fields (foreign guest)</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {FORM_C_FIELDS.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === "select" ? (
                        <select value={pastFormCFields[f.key] || ""} onChange={(e) => setPastFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {f.options!.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : f.type === "country" ? (
                        <select value={pastFormCFields[f.key] || ""} onChange={(e) => setPastFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <Input type={f.type} value={pastFormCFields[f.key] || ""} onChange={(e) => setPastFormCFields((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className="mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="sm:col-span-2 md:col-span-3">
              <Label className="text-xs">ID Card photos</Label>
              {pastIdFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {pastIdFiles.map((file, i) => (
                    <div key={i} className="relative">
                      {file.type === "application/pdf" ? (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-brand-mist bg-brand-sand/30 text-xs font-medium text-brand-green-dark/60">PDF</div>
                      ) : (
                        <img src={URL.createObjectURL(file)} alt={`ID ${i + 1}`} className="h-20 w-20 rounded-lg border border-brand-mist object-cover" />
                      )}
                      <button type="button" onClick={() => setPastIdFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600">
                        <XIcon className="h-3 w-3" />
                      </button>
                      <p className="mt-1 max-w-[80px] truncate text-center text-[10px] text-brand-green-dark/50">{i === 0 ? "Front" : i === 1 ? "Back" : `Page ${i + 1}`}</p>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-brand-sand/50">
                <UploadIcon className="h-4 w-4 text-amber-700" />
                {pastIdFiles.length === 0 ? "Choose files" : "Add more photos"}
                <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setPastIdFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
              </label>
              {pastIdFiles.length > 0 && (
                <p className="mt-1 text-[10px] text-brand-green-dark/50">{pastIdFiles.length} file(s) — upload front & back of ID</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="cta" onClick={addPastEntry} disabled={loading}>{loading ? "Saving..." : "Save Past Record"}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowPastForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editIndex !== null && (
        <div className="mt-4 rounded-2xl border-2 border-brand-green/20 bg-white p-6 shadow-card">
          <h3 className="font-display text-lg font-bold text-brand-green">Edit entry</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CHECKIN_COLUMNS.map((col, i) => (
              <div key={col}>
                <Label className="text-xs">{col}</Label>
                {col === "ID Card" || col === "Visa" ? (
                  <div className="mt-1 space-y-2">
                    {editEntry[i] && <p className="truncate text-xs text-brand-green-dark/60">{editEntry[i].split(" | ").filter(Boolean).length} file(s)</p>}
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-brand-sand/50">
                      <UploadIcon className="h-4 w-4 text-brand-green" />
                      {col === "ID Card" ? (editIdFiles.length > 0 ? `${editIdFiles.length} new` : "Replace") : (editVisaFiles.length > 0 ? `${editVisaFiles.length} new` : "Replace")}
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => col === "ID Card" ? setEditIdFiles(Array.from(e.target.files || [])) : setEditVisaFiles(Array.from(e.target.files || []))} />
                    </label>
                  </div>
                ) : (
                  <Input value={editEntry[i]} onChange={(e) => { const u = [...editEntry]; u[i] = e.target.value; setEditEntry(u); }} placeholder={col} className="mt-1" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="cta" onClick={updateRow} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditIndex(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-mist bg-white shadow-card">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-mist bg-brand-sand/50">
              {CHECKIN_COLUMNS.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-3 font-display text-xs font-bold uppercase tracking-wide text-brand-green-dark/70">{col}</th>
              ))}
              {role === "admin" && <th className="px-3 py-3 text-xs font-bold uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={CHECKIN_COLUMNS.length + 1} className="px-4 py-12 text-center text-brand-green-dark/50">{rows.length === 0 ? "No records" : "No matches"}</td></tr>
            ) : (
              filteredRows.map(({ row, origIdx }) => (
                <tr key={origIdx} className="border-b border-brand-mist/60 last:border-b-0 hover:bg-brand-sand/30">
                  {CHECKIN_COLUMNS.map((col, ci) => {
                    const cell = row[ci] || "";
                    const links = cell.includes(" | ") ? cell.split(" | ").filter((u) => u.startsWith("http")) : cell.startsWith("http") ? [cell] : [];

                    if (col === "Verified") {
                      return (
                        <td key={ci} className="whitespace-nowrap px-3 py-3">
                          {cell === "yes" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                              <ShieldCheckIcon className="h-3 w-3" /> Verified
                            </span>
                          ) : cell === "no" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              <ShieldAlertIcon className="h-3 w-3" /> Rejected
                            </span>
                          ) : (
                            <button type="button" onClick={() => setVerifyPopup({ origIdx, row })}
                              className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 hover:bg-yellow-200">
                              <ShieldAlertIcon className="h-3 w-3" /> Pending
                            </button>
                          )}
                        </td>
                      );
                    }

                    return (
                      <td key={ci} className="whitespace-nowrap px-3 py-3">
                        {links.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {links.map((url, li) => (
                              <a key={li} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-brand-green/[0.06] px-2 py-1 text-xs font-medium text-brand-green hover:bg-brand-green/[0.12]">
                                {links.length > 1 ? (li === 0 ? "Front" : li === 1 ? "Back" : `P${li + 1}`) : "View"} <ExternalLinkIcon className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        ) : col === "ID Card" && !cell && role === "admin" ? (
                          <button type="button" onClick={() => setUploadPopup({ origIdx, type: "id", guestName: row[3] || "Guest" })}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-green/[0.06] px-2 py-1 text-[10px] font-medium text-brand-green hover:bg-brand-green/[0.12]">
                            <UploadIcon className="h-3 w-3" /> Upload ID
                          </button>
                        ) : col === "Visa" && !cell && (row[8] || "").trim() !== "" && (row[8] || "").toLowerCase() !== "india" && role === "admin" ? (
                          <button type="button" onClick={() => setUploadPopup({ origIdx, type: "visa", guestName: row[3] || "Guest" })}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-600 hover:bg-amber-100">
                            <UploadIcon className="h-3 w-3" /> Upload Visa
                          </button>
                        ) : <span className="text-brand-green-dark/90">{cell}</span>}
                      </td>
                    );
                  })}
                  {role === "admin" && (
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {(row[8] || "").toLowerCase() !== "india" && row[8] && (
                          <button type="button" onClick={() => openFormC(origIdx, row)}
                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100">
                            <FileTextIcon className="h-3 w-3" /> Form C
                          </button>
                        )}
                        {row[18] === "checked_out" && row[19] && (Date.now() - new Date(row[19]).getTime() < 24 * 60 * 60 * 1000) && (
                          <button type="button" onClick={() => undoCheckout(origIdx)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-100">Reactivate</button>
                        )}
                        <button type="button" onClick={() => startEdit(origIdx)} className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-green/70 hover:bg-brand-green/[0.06]"><PencilIcon className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteRow(origIdx)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><Trash2Icon className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual verification popup */}
      {verifyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setVerifyPopup(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-green-dark">Manual ID Verification</h3>
              <button type="button" onClick={() => setVerifyPopup(null)} className="rounded-lg p-1 hover:bg-brand-sand">
                <XIcon className="h-5 w-5 text-brand-green-dark/50" />
              </button>
            </div>
            <p className="mt-2 text-sm text-brand-green-dark/70">
              Review the uploaded ID for <strong>{verifyPopup.row[3]}</strong> and mark as verified or rejected.
            </p>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green-dark/50">ID Documents</p>
              {(() => {
                const idCell = verifyPopup.row[14] || "";
                const visaCell = verifyPopup.row[15] || "";
                const idLinks = idCell.split(" | ").filter((u) => u.startsWith("http"));
                const visaLinks = visaCell.split(" | ").filter((u) => u.startsWith("http"));
                return (
                  <>
                    {idLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-brand-green-dark/50">ID ({verifyPopup.row[13]}):</span>
                        {idLinks.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-brand-green/[0.06] px-3 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/[0.12]">
                            {idLinks.length > 1 ? (i === 0 ? "Front" : "Back") : "View ID"} <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                    {visaLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-brand-green-dark/50">Visa:</span>
                        {visaLinks.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-brand-green/[0.06] px-3 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/[0.12]">
                            View <ExternalLinkIcon className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                    {idLinks.length === 0 && visaLinks.length === 0 && (
                      <p className="text-xs text-brand-green-dark/40">No documents uploaded</p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" disabled={verifying}
                onClick={() => verifyManually(verifyPopup.origIdx, true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50">
                {verifying ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <ShieldCheckIcon className="h-4 w-4" />}
                Verified
              </button>
              <button type="button" disabled={verifying}
                onClick={() => verifyManually(verifyPopup.origIdx, false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                {verifying ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <ShieldAlertIcon className="h-4 w-4" />}
                Rejected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline upload popup */}
      {uploadPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!uploading) { setUploadPopup(null); setUploadFiles([]); setUploadIdType(""); } }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-brand-green-dark">
                Upload {uploadPopup.type === "id" ? "ID Card" : "Visa"}
              </h3>
              <button type="button" disabled={uploading} onClick={() => { setUploadPopup(null); setUploadFiles([]); setUploadIdType(""); }} className="rounded-lg p-1 hover:bg-brand-sand">
                <XIcon className="h-5 w-5 text-brand-green-dark/50" />
              </button>
            </div>
            <p className="mt-2 text-sm text-brand-green-dark/70">
              Upload documents for <strong>{uploadPopup.guestName}</strong>
            </p>

            <div className="mt-4 space-y-4">
              {uploadPopup.type === "id" && (
                <div>
                  <Label className="text-xs">ID Type</Label>
                  <select value={uploadIdType} onChange={(e) => setUploadIdType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select type...</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="driving_licence">Driving Licence</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>
              )}

              <div>
                <Label className="text-xs">Files (images or PDF)</Label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-brand-sand/50">
                  <UploadIcon className="h-4 w-4 text-brand-green" />
                  {uploadFiles.length > 0 ? `${uploadFiles.length} file(s) selected` : "Choose files"}
                  <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setUploadFiles(Array.from(e.target.files)); }} />
                </label>
                {uploadFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadFiles.map((f, i) => (
                      <p key={i} className="truncate text-xs text-brand-green-dark/60">{f.name}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" disabled={uploading || uploadFiles.length === 0}
                onClick={handleInlineUpload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-green/90 disabled:opacity-50">
                {uploading ? <><Loader2Icon className="h-4 w-4 animate-spin" /> Uploading...</> : <><UploadIcon className="h-4 w-4" /> Upload</>}
              </button>
              <button type="button" disabled={uploading}
                onClick={() => { setUploadPopup(null); setUploadFiles([]); setUploadIdType(""); }}
                className="rounded-xl border border-input px-4 py-3 text-sm font-medium text-brand-green-dark/70 transition-colors hover:bg-brand-sand/50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form C preview modal */}
      {formCPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!formCEditing) setFormCPopup(null); }}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-indigo-800">Form C Data — {formCPopup.row[3]}</h3>
              <div className="flex items-center gap-2">
                {!formCEditing && (
                  <button type="button" onClick={async () => {
                    if (!confirm("Re-read passport/visa images and extract data again?")) return;
                    setFormCLoading(true);
                    try {
                      const rowId = parseInt(formCPopup.row[17] || "0", 10);
                      const res = await apiCall({ action: "reExtractFormC", rowId });
                      if (res.ok) {
                        const d = await res.json();
                        setFormCPopup({ ...formCPopup, data: d.formCData ? JSON.parse(d.formCData) : formCPopup.data });
                        alert("Data re-extracted from images!");
                      } else { alert("Re-extraction failed"); }
                    } finally { setFormCLoading(false); }
                  }} className="rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-200">
                    Re-extract
                  </button>
                )}
                {!formCEditing && (
                  <button type="button" onClick={() => {
                    setFormCEditing(true);
                    const p = formCPopup.data.extractedPassport || {};
                    const v = formCPopup.data.extractedVisa || {};
                    const nameParts = (formCPopup.row[3] || "").split(" ");
                    setFormCEditData({
                      surname: p.surname || nameParts.slice(-1).join("") || "",
                      givenName: p.givenName || nameParts.slice(0, -1).join(" ") || "",
                      passportNumber: p.passportNumber || "",
                      dateOfBirth: p.dateOfBirth || "",
                      sex: p.sex || "",
                      expiryDate: p.expiryDate || "",
                      passportDateOfIssue: p.dateOfIssue || "",
                      placeOfIssue: p.placeOfIssue || "",
                      passportNationality: p.nationality || formCPopup.row[8] || "",
                      passportCountry: formCPopup.row[8] || "",
                      visaNumber: v.visaNumber || "",
                      visaType: v.type || "Tourist",
                      visaDateOfIssue: v.dateOfIssue || "",
                      visaValidTill: v.validTill || "",
                      visaPlaceOfIssue: v.placeOfIssue || "",
                      visaCountry: "INDIA",
                      arrivedFromCountry: formCPopup.data.arrivedFromCountry || "",
                      arrivedFromCity: formCPopup.data.arrivedFromCity || "",
                      arrivedFromPlace: formCPopup.data.arrivedFromPlace || "",
                      dateOfArrivalInIndia: formCPopup.data.dateOfArrivalInIndia || "",
                      dateOfArrivalInHotel: formCPopup.row[1] || "",
                      timeOfArrivalInHotel: formCPopup.row[2] || "",
                      durationOfStay: formCPopup.row[6] || "",
                      purposeOfVisit: formCPopup.data.purposeOfVisit || "Tourism",
                      employedInIndia: formCPopup.data.employedInIndia || "No",
                      nextDestination: formCPopup.data.nextDestination || "",
                      nextDestState: formCPopup.data.nextDestState || "",
                      nextDestCity: formCPopup.data.nextDestCity || "",
                      homeAddress: formCPopup.data.homeAddress || "",
                      homeCity: formCPopup.data.homeCity || "",
                      homeCountry: formCPopup.row[8] || "",
                      homeCountryPhone: formCPopup.data.homeCountryPhone || "",
                      contactIndia: formCPopup.row[5] || "",
                      indiaAddress: "Near Hema Shree, Gokarna Main Beach",
                      indiaState: "KARNATAKA",
                      indiaCity: "UTTARA KANNADA",
                      indiaPinCode: "581421",
                    });
                  }} className="rounded-lg bg-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/20">
                    <PencilIcon className="mr-1 inline h-3 w-3" /> Edit
                  </button>
                )}
                <button type="button" onClick={() => { setFormCPopup(null); setFormCEditing(false); }} className="rounded-lg p-1 hover:bg-brand-sand">
                  <XIcon className="h-5 w-5 text-brand-green-dark/50" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-brand-green-dark/60">
              {formCEditing ? "Edit Form C data — changes will be saved to the record" : "FRRO Form C data extracted from passport, visa, and check-in form"}
            </p>

            {formCEditing ? (
              <div className="mt-4 space-y-4">
                <FormCEditSection title="Personal Details" fields={[
                  { key: "surname", label: "Surname" },
                  { key: "givenName", label: "Given Name" },
                  { key: "sex", label: "Sex" },
                  { key: "dateOfBirth", label: "Date of Birth (DD/MM/YYYY)" },
                  { key: "passportNationality", label: "Nationality" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="Home Address" fields={[
                  { key: "homeAddress", label: "Address" },
                  { key: "homeCity", label: "City" },
                  { key: "homeCountry", label: "Country" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="India Address (Hotel)" fields={[
                  { key: "indiaAddress", label: "Address" },
                  { key: "indiaState", label: "State" },
                  { key: "indiaCity", label: "City/District" },
                  { key: "indiaPinCode", label: "Pin Code" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="Passport Details" fields={[
                  { key: "passportNumber", label: "Passport No" },
                  { key: "placeOfIssue", label: "Place of Issue (City)" },
                  { key: "passportCountry", label: "Place of Issue (Country)" },
                  { key: "passportDateOfIssue", label: "Date of Issue (DD/MM/YYYY)" },
                  { key: "expiryDate", label: "Valid Till (DD/MM/YYYY)" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="Visa Details" fields={[
                  { key: "visaNumber", label: "Visa No" },
                  { key: "visaType", label: "Type of Visa" },
                  { key: "visaDateOfIssue", label: "Date of Issue (DD/MM/YYYY)" },
                  { key: "visaValidTill", label: "Valid Till (DD/MM/YYYY)" },
                  { key: "visaPlaceOfIssue", label: "Place of Issue (City)" },
                  { key: "visaCountry", label: "Place of Issue (Country)" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="Arrival Information" fields={[
                  { key: "arrivedFromCountry", label: "Arrived from Country" },
                  { key: "arrivedFromCity", label: "Arrived from City" },
                  { key: "arrivedFromPlace", label: "Arrived from Place" },
                  { key: "dateOfArrivalInIndia", label: "Date of Arrival in India" },
                  { key: "dateOfArrivalInHotel", label: "Date of Arrival in Hotel" },
                  { key: "timeOfArrivalInHotel", label: "Time of Arrival in Hotel" },
                  { key: "durationOfStay", label: "Duration of Stay (days)" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <FormCEditSection title="Other Details" fields={[
                  { key: "employedInIndia", label: "Employed in India" },
                  { key: "purposeOfVisit", label: "Purpose of Visit" },
                  { key: "nextDestination", label: "Next Destination" },
                  { key: "nextDestState", label: "State" },
                  { key: "nextDestCity", label: "City" },
                  { key: "contactIndia", label: "Contact Phone (India)" },
                  { key: "homeCountryPhone", label: "Phone (Home Country)" },
                ]} data={formCEditData} onChange={setFormCEditData} />
                <div className="flex gap-2">
                  <Button type="button" variant="cta" disabled={formCSaving} onClick={async () => {
                    setFormCSaving(true);
                    try {
                      const updatedData = {
                        ...formCPopup.data,
                        extractedPassport: { surname: formCEditData.surname, givenName: formCEditData.givenName, passportNumber: formCEditData.passportNumber, dateOfBirth: formCEditData.dateOfBirth, sex: formCEditData.sex, dateOfIssue: formCEditData.passportDateOfIssue, expiryDate: formCEditData.expiryDate, placeOfIssue: formCEditData.placeOfIssue, nationality: formCEditData.passportNationality },
                        extractedVisa: { visaNumber: formCEditData.visaNumber, type: formCEditData.visaType, dateOfIssue: formCEditData.visaDateOfIssue, validTill: formCEditData.visaValidTill, placeOfIssue: formCEditData.visaPlaceOfIssue },
                        arrivedFromCountry: formCEditData.arrivedFromCountry, arrivedFromCity: formCEditData.arrivedFromCity, arrivedFromPlace: formCEditData.arrivedFromPlace,
                        dateOfArrivalInIndia: formCEditData.dateOfArrivalInIndia, purposeOfVisit: formCEditData.purposeOfVisit, employedInIndia: formCEditData.employedInIndia,
                        nextDestination: formCEditData.nextDestination, nextDestState: formCEditData.nextDestState, nextDestCity: formCEditData.nextDestCity,
                        homeAddress: formCEditData.homeAddress, homeCity: formCEditData.homeCity, homeCountryPhone: formCEditData.homeCountryPhone,
                      };
                      const rowId = parseInt(formCPopup.row[17] || "0", 10);
                      const res = await apiCall({ action: "updateFormCData", rowId, formCData: JSON.stringify(updatedData) });
                      if (res.ok) {
                        setFormCPopup({ ...formCPopup, data: updatedData });
                        setFormCEditing(false);
                      } else { alert("Failed to save"); }
                    } finally { setFormCSaving(false); }
                  }}>{formCSaving ? "Saving..." : "Save Changes"}</Button>
                  <Button type="button" variant="ghost" onClick={() => setFormCEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {(() => {
                  const p = formCPopup.data.extractedPassport || {};
                  const v = formCPopup.data.extractedVisa || {};
                  const dob = p.dateOfBirth || "";
                  let age = "";
                  if (dob) {
                    const parts = dob.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    if (parts) { age = String(new Date().getFullYear() - parseInt(parts[3])); }
                  }
                  return (
                    <>
                      <FormCSection title="Personal Details" items={[
                        { label: "Surname", value: p.surname },
                        { label: "Given Name", value: p.givenName || formCPopup.row[3] },
                        { label: "Sex", value: p.sex },
                        { label: "Date of Birth", value: dob },
                        { label: "Age", value: age },
                        { label: "Special Category", value: "Others" },
                        { label: "Nationality", value: formCPopup.row[8] },
                      ]} />

                      <FormCSection title="Home Address" items={[
                        { label: "Address", value: formCPopup.data.homeAddress },
                        { label: "City", value: formCPopup.data.homeCity },
                        { label: "Country", value: formCPopup.row[8] },
                      ]} />

                      <FormCSection title="Address in India (Hotel)" items={[
                        { label: "Address", value: "Near Hema Shree, Gokarna Main Beach" },
                        { label: "State", value: "KARNATAKA" },
                        { label: "City/District", value: "UTTARA KANNADA" },
                        { label: "Pin Code", value: "581421" },
                      ]} />

                      <FormCSection title="Passport Details" items={[
                        { label: "Passport No", value: p.passportNumber },
                        { label: "Place of Issue (City)", value: p.placeOfIssue },
                        { label: "Place of Issue (Country)", value: p.nationality || formCPopup.row[8] },
                        { label: "Date of Issue", value: p.dateOfIssue },
                        { label: "Valid Till", value: p.expiryDate },
                      ]} />

                      <FormCSection title="Visa Details" items={[
                        { label: "Visa No", value: v.visaNumber, unreliable: true },
                        { label: "Place of Issue (City)", value: v.placeOfIssue, unreliable: true },
                        { label: "Place of Issue (Country)", value: "INDIA" },
                        { label: "Date of Issue", value: v.dateOfIssue, unreliable: true },
                        { label: "Valid Till", value: v.validTill, unreliable: true },
                        { label: "Type of Visa", value: v.type, unreliable: true },
                      ]} />

                      <FormCSection title="Arrival Information" items={[
                        { label: "Arrived from Country", value: formCPopup.data.arrivedFromCountry },
                        { label: "Arrived from City", value: formCPopup.data.arrivedFromCity },
                        { label: "Arrived from Place", value: formCPopup.data.arrivedFromPlace },
                        { label: "Date of Arrival in India", value: formCPopup.data.dateOfArrivalInIndia },
                        { label: "Date of Arrival in Hotel", value: formCPopup.row[1] },
                        { label: "Time of Arrival in Hotel", value: formCPopup.row[2] },
                        { label: "Duration of Stay (days)", value: formCPopup.row[6] },
                      ]} />

                      <FormCSection title="Other Details" items={[
                        { label: "Employed in India", value: formCPopup.data.employedInIndia || "No" },
                        { label: "Purpose of Visit", value: formCPopup.data.purposeOfVisit },
                        { label: "Next Destination", value: [formCPopup.data.nextDestination, formCPopup.data.nextDestState, formCPopup.data.nextDestCity].filter(Boolean).join(", ") },
                        { label: "Contact Phone (India)", value: formCPopup.row[5] },
                        { label: "Mobile (India)", value: formCPopup.row[5] },
                        { label: "Phone (Home Country)", value: formCPopup.data.homeCountryPhone },
                      ]} />
                    </>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {(formCPopup.data.frroApplicationId || formCPopup.data.frroSubmissions?.length > 0) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Form C submitted to FRRO</p>
                  {formCPopup.data.frroSubmissions?.length > 0 ? (
                    <div className="mt-1 space-y-1.5">
                      {formCPopup.data.frroSubmissions.map((sub: { id: string; date: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-emerald-700">#{i + 1} Application ID: <span className="font-bold">{sub.id}</span></span>
                          <span className="text-[10px] text-emerald-600">({new Date(sub.date).toLocaleString()})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-emerald-700">Application ID: <span className="font-bold">{formCPopup.data.frroApplicationId}</span></p>
                      {formCPopup.data.frroSubmittedAt && (
                        <p className="mt-0.5 text-[10px] text-emerald-600">Submitted: {new Date(formCPopup.data.frroSubmittedAt).toLocaleString()}</p>
                      )}
                    </>
                  )}
                  <div className="mt-2 rounded-lg bg-emerald-100 p-2">
                    <p className="text-[11px] text-emerald-800"><strong>Next steps:</strong> Review the details and submit permanently by logging in here:</p>
                    <a href="https://indianfrro.gov.in/frro/FormC/login.jsp" target="_blank" rel="noopener" className="mt-1 inline-block text-xs font-medium text-emerald-700 underline hover:text-emerald-900">https://indianfrro.gov.in/frro/FormC/login.jsp</a>
                    <p className="mt-1 text-[10px] text-emerald-700">Enter latest Application ID → review → click &quot;Save and Continue&quot; to submit permanently.</p>
                  </div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={frroSubmitting}
                  onClick={async () => {
                    setFrroSubmitting(true);
                    setFrroStatus("Connecting to local server...");
                    try {
                      const checkinId = formCPopup.row[17];
                      const secret = password;
                      const expiry = Date.now() + 60 * 60 * 1000;
                      const payload = `${checkinId}:${expiry}`;
                      const hash = btoa(payload + ":" + secret).replace(/=/g, "");
                      const token = `${btoa(payload).replace(/=/g, "")}.${hash}`;
                      const apiUrl = `${window.location.origin}/api/form-c/${checkinId}?token=${token}`;
                      const res = await fetch("http://localhost:3456/fill-form-c", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ apiUrl, frroUsername, frroPassword }),
                      }).catch(() => null);
                      if (!res) { setFrroStatus("Local server not running. Start with: frro (in terminal)"); return; }
                      const data = await res.json();
                      if (data.success) {
                        const appId = data.applicationId || "saved";
                        if (appId.startsWith("FAILED") || appId.includes("check") || appId.includes("missing")) {
                          setFrroStatus(appId);
                        } else {
                          setFrroStatus(`Success! Application ID: ${appId}`);
                          const rowId = parseInt(formCPopup.row[17] || "0", 10);
                          const prevSubs = formCPopup.data.frroSubmissions || [];
                          if (formCPopup.data.frroApplicationId && !prevSubs.length) {
                            prevSubs.push({ id: formCPopup.data.frroApplicationId, date: formCPopup.data.frroSubmittedAt || new Date().toISOString() });
                          }
                          prevSubs.push({ id: appId, date: new Date().toISOString() });
                          const updatedData = { ...formCPopup.data, frroApplicationId: appId, frroSubmittedAt: new Date().toISOString(), frroSubmissions: prevSubs };
                          await apiCall({ action: "updateFormCData", rowId, formCData: JSON.stringify(updatedData) });
                          setFormCPopup({ ...formCPopup, data: updatedData });
                        }
                      } else if (data.waitingForCaptcha) {
                        setFrroStatus("Solve CAPTCHA in browser window... (polling for result)");
                        const poll = setInterval(async () => {
                          try {
                            const statusRes = await fetch("http://localhost:3456/status");
                            const statusData = await statusRes.json();
                            if (statusData.lastResult) {
                              clearInterval(poll);
                              if (statusData.lastResult.success) {
                                const appId = statusData.lastResult.applicationId || "Form C saved";
                                if (appId.startsWith("FAILED") || appId.includes("check") || appId.includes("missing")) {
                                  setFrroStatus(appId);
                                } else {
                                  setFrroStatus(`Success! Application ID: ${appId}`);
                                  const rowId = parseInt(formCPopup!.row[17] || "0", 10);
                                  const prevSubs = formCPopup!.data.frroSubmissions || [];
                                  if (formCPopup!.data.frroApplicationId && !prevSubs.length) {
                                    prevSubs.push({ id: formCPopup!.data.frroApplicationId, date: formCPopup!.data.frroSubmittedAt || new Date().toISOString() });
                                  }
                                  prevSubs.push({ id: appId, date: new Date().toISOString() });
                                  const updatedData = { ...formCPopup!.data, frroApplicationId: appId, frroSubmittedAt: new Date().toISOString(), frroSubmissions: prevSubs };
                                  apiCall({ action: "updateFormCData", rowId, formCData: JSON.stringify(updatedData) });
                                  setFormCPopup({ ...formCPopup!, data: updatedData });
                                }
                              } else { setFrroStatus(statusData.lastResult.error || "Failed"); }
                              setFrroSubmitting(false);
                            }
                          } catch { clearInterval(poll); }
                        }, 3000);
                        return;
                      }
                      else { setFrroStatus(data.error || "Failed"); }
                    } catch (e: any) { setFrroStatus(e.message || "Connection failed"); }
                    finally { setFrroSubmitting(false); }
                  }}
                  className="rounded-xl bg-brand-green px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-dark disabled:opacity-50"
                >
                  {frroSubmitting ? "Submitting..." : "Desktop: Auto-Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const checkinId = formCPopup.row[17];
                    const secret = password;
                    const expiry = Date.now() + 60 * 60 * 1000;
                    const payload = `${checkinId}:${expiry}`;
                    const hash = btoa(payload + ":" + secret).replace(/=/g, "");
                    const token = `${btoa(payload).replace(/=/g, "")}.${hash}`;
                    const apiUrl = `${window.location.origin}/api/form-c/${checkinId}?token=${token}`;
                    const script = `fetch('${apiUrl}').then(r=>r.json()).then(d=>{const fmtD=(s)=>{if(!s)return'';if(/^\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{4}$/.test(s))return s.replace(/[.-]/g,'/');const m=s.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);if(m)return m[3]+'/'+m[2]+'/'+m[1];const mn={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};const tm=s.match(/^(\\d{1,2})\\s+([A-Za-z]{3,})\\s+(\\d{4})$/);if(tm){const mo=mn[tm[2].toUpperCase().slice(0,3)];if(mo)return tm[1].padStart(2,'0')+'/'+mo+'/'+tm[3];}return s;};const FD=(n,v)=>{if(!v)return;const fv=fmtD(v);if(!fv)return;const el=document.querySelector('input[name=\"'+n+'\"]');if(el){el.removeAttribute('readonly');el.removeAttribute('disabled');el.value=fv;el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('input',{bubbles:true}));if(window.jQuery&&jQuery(el).datepicker){try{const p=fv.split('/');if(p.length===3)jQuery(el).datepicker('setDate',new Date(+p[2],+p[1]-1,+p[0]));}catch{}}}};const F=(n,v)=>{if(!v)return;const els=document.querySelectorAll('input[name=\"'+n+'\"],select[name=\"'+n+'\"],textarea[name=\"'+n+'\"]');if(els.length){els.forEach(el=>{if(el.tagName==='SELECT'){const opts=[...el.options];const match=opts.find(o=>o.text.toUpperCase().includes(v.toUpperCase())||o.value.toUpperCase().includes(v.toUpperCase()));if(match){el.value=match.value;el.dispatchEvent(new Event('change',{bubbles:true}));}else el.value=v;}else if(el.type==='radio'){if(el.value.toLowerCase()===v.toLowerCase())el.checked=true;}else{el.removeAttribute('readonly');el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}});}};const n2=d.extractedPassport||{};const v2=d.extractedVisa||{};F('applicant_surname',n2.surname||d.guestName?.split(' ').pop()||'');F('applicant_givenname',n2.givenName||d.guestName?.split(' ').slice(0,-1).join(' ')||'');F('applicant_sex',n2.sex||'');F('dobformat','DD/MM/YYYY');FD('applicant_dob',n2.dateOfBirth||'');F('applicant_special_category','Others');F('applicant_nationality',d.nationality||'');F('applicant_permaddr',[d.homeAddress,d.homeCity].filter(Boolean).join(', ')||'');F('applicant_permcity',d.homeCity||'');F('applicant_permcountry',d.nationality||'');F('applicant_refaddr','Near Hema Shree, Gokarna Main Beach');F('applicant_refstate','KARNATAKA');F('applicant_refpincode','581421');F('applicant_passpno',n2.passportNumber||'');F('applicant_passplcofissue',n2.placeOfIssue||'');F('passport_issue_country',d.nationality||'');FD('applicant_passpdoissue',n2.dateOfIssue||'');FD('applicant_passpvalidtill',n2.expiryDate||'');F('applicant_visano',v2.visaNumber||'');F('applicant_visaplcoissue',v2.placeOfIssue||'');F('visa_issue_country','INDIA');FD('applicant_visadoissue',v2.dateOfIssue||'');FD('applicant_visavalidtill',v2.validTill||'');F('applicant_visatype',v2.type||'Tourist');F('applicant_arrivedfromcountry',d.arrivedFromCountry||'');F('applicant_arrivedfromcity',d.arrivedFromCity||'');F('applicant_arrivedfromplace',d.arrivedFromPlace||'');FD('applicant_doarrivalindia',d.dateOfArrivalInIndia||'');FD('applicant_doarrivalhotel',d.arrivalDate||'');F('applicant_timeoarrivalhotel',d.arrivalTime||'');F('applicant_intnddurhotel',d.stayingDays||'');F('applicant_purpovisit',d.purposeOfVisit||'Tourism');F('applicant_contactnoinindia',d.contact||'');F('applicant_mcontactnoinindia',d.contact||'');F('applicant_contactnoperm',d.homeCountryPhone||'');F('applicant_mcontactnoperm',d.homeCountryPhone||'');setTimeout(()=>{FD('applicant_dob',n2.dateOfBirth||'');FD('applicant_passpdoissue',n2.dateOfIssue||'');FD('applicant_passpvalidtill',n2.expiryDate||'');FD('applicant_visadoissue',v2.dateOfIssue||'');FD('applicant_visavalidtill',v2.validTill||'');FD('applicant_doarrivalindia',d.dateOfArrivalInIndia||'');FD('applicant_doarrivalhotel',d.arrivalDate||'');},500);alert('Form C fields filled! Review dates and click Temporary Save.');}).catch(e=>alert('Error: '+e.message))`;
                    navigator.clipboard.writeText(script).then(() => {
                      alert("Copied! On FRRO Form C page, open browser console (F12) and paste.");
                    }).catch(() => {
                      prompt("Copy this, paste in FRRO page console (F12):", script);
                    });
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  Mobile: Copy Script
                </button>
              </div>
              {frroStatus && (
                <p className={cn("text-center text-xs font-medium", frroStatus.includes("Success") ? "text-emerald-600" : frroStatus.includes("Failed") || frroStatus.includes("not running") ? "text-red-600" : "text-amber-600")}>{frroStatus}</p>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const checkinId = formCPopup.row[17];
                    const secret = password;
                    const expiry = Date.now() + 60 * 60 * 1000;
                    const payload = `${checkinId}:${expiry}`;
                    const hash = btoa(payload + ":" + secret).replace(/=/g, "");
                    const token = `${btoa(payload).replace(/=/g, "")}.${hash}`;
                    const res = await fetch(`/api/form-c/${checkinId}?token=${token}`);
                    if (!res.ok) { alert("Failed to fetch photo"); return; }
                    const data = await res.json();
                    if (!data.passportPhotoBase64) { alert("No photo available for this guest"); return; }
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      canvas.width = 300; canvas.height = 400;
                      const ctx = canvas.getContext("2d")!;
                      ctx.drawImage(img, 0, 0, 300, 400);
                      let quality = 0.85;
                      let dataUrl = canvas.toDataURL("image/jpeg", quality);
                      while (dataUrl.length * 0.75 > 48000 && quality > 0.2) {
                        quality -= 0.05;
                        dataUrl = canvas.toDataURL("image/jpeg", quality);
                      }
                      const a = document.createElement("a");
                      a.href = dataUrl;
                      a.download = "photo.jpg";
                      a.click();
                    };
                    img.src = "data:image/jpeg;base64," + data.passportPhotoBase64;
                  } catch (e: any) { alert("Error: " + e.message); }
                }}
                className="w-full rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-200"
              >
                Download Photo for FRRO Upload (under 48KB)
              </button>
              <div className="flex items-center justify-center gap-3 text-[10px] text-brand-green-dark/50">
                <span>Mobile: paste script in browser console on FRRO page</span>
                <span>·</span>
                <a href="/frro-setup-guide.txt" download className="font-medium text-brand-green underline hover:text-brand-green-dark">Download Desktop Setup Guide</a>
              </div>

              <button type="button" onClick={() => setFrroSettingsOpen(!frroSettingsOpen)} className="w-full text-left text-xs font-medium text-brand-green-dark/60 hover:text-brand-green-dark">
                {frroSettingsOpen ? "▼" : "▶"} FRRO Login Credentials
              </button>
              {frroSettingsOpen && (
                <div className="grid gap-2 rounded-lg border border-brand-mist bg-brand-sand/30 p-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-brand-green-dark/50">FRRO Username</label>
                    <input type="text" value={frroUsername} onChange={(e) => setFrroUsername(e.target.value)} placeholder="Username" className="mt-0.5 w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-brand-green-dark/50">FRRO Password</label>
                    <input type="password" value={frroPassword} onChange={(e) => setFrroPassword(e.target.value)} placeholder="••••••" className="mt-0.5 w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm" />
                  </div>
                  <button type="button" onClick={async () => {
                    await apiCall({ action: "setSetting", key: "frro_username", value: frroUsername });
                    await apiCall({ action: "setSetting", key: "frro_password", value: frroPassword });
                    alert("FRRO credentials saved");
                  }} className="sm:col-span-2 rounded-md bg-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green hover:bg-brand-green/20">
                    Save Credentials
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormCSection({ title, items }: { title: string; items: { label: string; value?: string; unreliable?: boolean }[] }) {
  const hasUnreliable = items.some((i) => i.unreliable && i.value);
  const missingCount = items.filter((i) => !i.value).length;
  return (
    <div className={cn("rounded-xl border p-4", missingCount > 0 ? "border-red-200 bg-red-50/20" : hasUnreliable ? "border-amber-200 bg-amber-50/20" : "border-brand-mist")}>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-green-dark/50">
        {title}
        {missingCount > 0 && <span className="text-[9px] font-normal normal-case text-red-600">⚠ {missingCount} missing — fill before submitting</span>}
        {hasUnreliable && !missingCount && <span className="text-[9px] font-normal normal-case text-amber-600">⚠ verify handwritten fields</span>}
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <span className={cn("text-[10px]", !item.value ? "text-red-500 font-medium" : item.unreliable ? "text-amber-600 font-medium" : "text-brand-green-dark/50")}>
              {item.label}{!item.value ? " ⚠" : item.unreliable ? " ⚠" : ""}
            </span>
            {item.value ? (
              <p className={cn("text-sm font-medium", item.unreliable ? "text-amber-800" : "text-brand-green-dark")}>{item.value}</p>
            ) : (
              <p className="text-sm font-medium italic text-red-400">Missing — click Edit to fill</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormCEditSection({ title, fields, data, onChange }: {
  title: string;
  fields: { key: string; label: string }[];
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-600/70">{title}</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-[10px] text-brand-green-dark/50">{f.label}</label>
            <input
              type="text"
              value={data[f.key] || ""}
              onChange={(e) => onChange({ ...data, [f.key]: e.target.value })}
              className="mt-0.5 w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm"
              placeholder={f.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
