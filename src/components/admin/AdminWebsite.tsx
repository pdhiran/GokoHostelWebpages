"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminLoading } from "./AdminLoading";
import { SiteImageField } from "./SiteImageField";
import { useAdminToast } from "./AdminToast";
import { cn } from "@/lib/utils";
import { ICON_NAMES } from "@/components/ui/Icon";
import {
  defaultCommunityCopy,
  defaultEventsCopy,
  parseJsonArray,
  type CommunityPageCopy,
  type EventsPageCopy,
} from "@/lib/siteCopy";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { Role } from "./types";

type EventRow = {
  id: number;
  date: string;
  title: string;
  description: string;
  tags: string;
  isPast: number;
  coverUrl: string;
  photos: string;
  displayOrder: number;
};

type SpaceRow = {
  id: number;
  title: string;
  icon: string;
  description: string;
  imageUrl: string;
  photos: string;
  displayOrder: number;
};

type EventForm = {
  date: string;
  title: string;
  description: string;
  tags: string;
  isPast: boolean;
  coverUrl: string;
  photos: string[];
};

const emptyEvent: EventForm = {
  date: "", title: "", description: "", tags: "", isPast: false, coverUrl: "", photos: [],
};

type SpaceForm = {
  title: string;
  icon: string;
  description: string;
  imageUrl: string;
  photos: string[];
};

const emptySpace: SpaceForm = { title: "", icon: "sofa", description: "", imageUrl: "", photos: [] };

export function AdminWebsite({ password, username, role }: { password: string; username?: string; role: Role }) {
  const { showError, showSuccess } = useAdminToast();
  const [tab, setTab] = useState<"events" | "community">("events");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyUploads, setBusyUploads] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [eventsCopy, setEventsCopy] = useState<EventsPageCopy>(defaultEventsCopy);
  const [communityCopy, setCommunityCopy] = useState<CommunityPageCopy>(defaultCommunityCopy);

  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);

  const [spaceForm, setSpaceForm] = useState<SpaceForm>(emptySpace);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [showSpaceForm, setShowSpaceForm] = useState(false);

  const apiCall = useCallback(async (body: Record<string, unknown>) => {
    const payload: Record<string, unknown> = { password, ...body };
    if (username) payload.username = username;
    return fetch("/api/admin/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }, [password, username]);

  const onBusy = useCallback((busy: boolean) => {
    setBusyUploads((n) => Math.max(0, n + (busy ? 1 : -1)));
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const res = await apiCall({ action: "getAll" });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Failed to load website content";
        setLoadError(message);
        showError(message);
        return;
      }
      setLoadError("");
      setEvents(data.events || []);
      setSpaces(data.spaces || []);
      if (data.eventsCopy) setEventsCopy(data.eventsCopy);
      if (data.communityCopy) setCommunityCopy(data.communityCopy);
    } catch {
      const message = "Could not reach the website CMS";
      setLoadError(message);
      showError(message);
    }
  }, [apiCall, showError]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  if (role !== "admin") {
    return <p className="text-sm text-brand-green-dark/70">Admin access required to edit the public website.</p>;
  }
  if (loading) return <AdminLoading message="Loading website content..." />;
  if (loadError) {
    const piOrMigrate = /live site|no such table|not bound/i.test(loadError);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Could not load website content</p>
        <p className="mt-1">{loadError}</p>
        {piOrMigrate ? (
          <p className="mt-2 text-red-700/80">
            On the live Cloudflare site, apply migration 0035 and bind the goko-media R2 bucket. This tab is not available on the Pi.
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-3"
          onClick={() => {
            setLoading(true);
            loadAll().finally(() => setLoading(false));
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const upcoming = events.filter((e) => !e.isPast);
  const past = events.filter((e) => e.isPast);
  const locked = saving || busyUploads > 0;

  const saveEventsCopy = async () => {
    setSaving(true);
    try {
      const res = await apiCall({ action: "saveEventsCopy", copy: eventsCopy });
      const data = await res.json();
      if (!res.ok) showError(data.error || "Failed to save");
      else showSuccess("Events page text saved");
    } catch {
      showError("Could not reach the website CMS");
    } finally { setSaving(false); }
  };

  const saveCommunityCopy = async () => {
    setSaving(true);
    try {
      const res = await apiCall({ action: "saveCommunityCopy", copy: communityCopy });
      const data = await res.json();
      if (!res.ok) showError(data.error || "Failed to save");
      else showSuccess("Community page text saved");
    } catch {
      showError("Could not reach the website CMS");
    } finally { setSaving(false); }
  };

  const saveEvent = async () => {
    if (!eventForm.title.trim()) { showError("Title is required"); return; }
    setSaving(true);
    try {
      const photos = eventForm.photos.length ? eventForm.photos : (eventForm.coverUrl ? [eventForm.coverUrl] : []);
      const payload = {
        date: eventForm.date,
        title: eventForm.title,
        description: eventForm.description,
        tags: eventForm.tags,
        isPast: eventForm.isPast,
        coverUrl: eventForm.coverUrl,
        photos,
      };
      const res = editingEventId
        ? await apiCall({ action: "updateEvent", id: editingEventId, ...payload })
        : await apiCall({ action: "addEvent", ...payload });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Failed to save event"); return; }
      showSuccess(editingEventId ? "Event updated" : "Event added");
      setShowEventForm(false);
      setEditingEventId(null);
      await loadAll();
    } catch {
      showError("Could not reach the website CMS");
    } finally { setSaving(false); }
  };

  const saveSpace = async () => {
    if (!spaceForm.title.trim()) { showError("Title is required"); return; }
    setSaving(true);
    try {
      const photos = spaceForm.photos.length ? spaceForm.photos : (spaceForm.imageUrl ? [spaceForm.imageUrl] : []);
      const payload = {
        title: spaceForm.title,
        icon: spaceForm.icon,
        description: spaceForm.description,
        imageUrl: spaceForm.imageUrl,
        photos,
      };
      const res = editingSpaceId
        ? await apiCall({ action: "updateSpace", id: editingSpaceId, ...payload })
        : await apiCall({ action: "addSpace", ...payload });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Failed to save space"); return; }
      showSuccess(editingSpaceId ? "Space updated" : "Space added");
      setShowSpaceForm(false);
      setEditingSpaceId(null);
      await loadAll();
    } catch {
      showError("Could not reach the website CMS");
    } finally { setSaving(false); }
  };

  const deleteItem = async (action: "deleteEvent" | "deleteSpace", id: number, okMsg: string) => {
    try {
      const res = await apiCall({ action, id });
      const data = await res.json();
      if (!res.ok) showError(data.error || "Delete failed");
      else { showSuccess(okMsg); await loadAll(); }
    } catch {
      showError("Could not reach the website CMS");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-green">Website pages</h3>
        <p className="mt-1 text-sm text-brand-green-dark/70">
          Edit Events and Community Area. Uploads preview here; they go live when you save — no deploy needed.
          {" "}<a href="/events" target="_blank" rel="noreferrer" className="underline">Open Events</a>
          {" · "}
          <a href="/community-area" target="_blank" rel="noreferrer" className="underline">Open Community Area</a>
        </p>
      </div>

      <div className="flex gap-1.5 rounded-xl border border-brand-mist bg-white p-1.5">
        {(["events", "community"] as const).map((id) => (
          <button
            key={id}
            type="button"
            disabled={locked}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium",
              tab === id ? "bg-brand-green/10 text-brand-green" : "text-brand-green-dark/60 hover:bg-brand-sand/50",
            )}
          >
            {id === "events" ? "Events" : "Community Area"}
          </button>
        ))}
      </div>

      {tab === "events" && (
        <div className="space-y-8">
          <section className="space-y-4 rounded-xl border border-brand-mist bg-white p-4 md:p-6">
            <h4 className="font-semibold text-brand-green-dark">Page text</h4>
            <Field label="Hero title" value={eventsCopy.hero.title} onChange={(v) => setEventsCopy({ ...eventsCopy, hero: { ...eventsCopy.hero, title: v } })} />
            <Area label="Hero subtitle" value={eventsCopy.hero.subtitle} onChange={(v) => setEventsCopy({ ...eventsCopy, hero: { ...eventsCopy.hero, subtitle: v } })} />
            <Field label="Chips (comma separated)" value={eventsCopy.hero.chips.join(", ")} onChange={(v) => setEventsCopy({ ...eventsCopy, hero: { ...eventsCopy.hero, chips: v.split(",").map((s) => s.trim()).filter(Boolean) } })} />
            <SiteImageField label="Hero still image (reduced-motion fallback — looping video is not edited here)" value={eventsCopy.hero.ribbonImage} kind="hero" folder="heroes" password={password} username={username} onBusy={onBusy} onChange={(url) => setEventsCopy((prev) => ({ ...prev, hero: { ...prev.hero, ribbonImage: url } }))} />
            <Field label="Bottom CTA title" value={eventsCopy.pastCta.title} onChange={(v) => setEventsCopy({ ...eventsCopy, pastCta: { ...eventsCopy.pastCta, title: v } })} />
            <Area label="Bottom CTA text" value={eventsCopy.pastCta.body} onChange={(v) => setEventsCopy({ ...eventsCopy, pastCta: { ...eventsCopy.pastCta, body: v } })} />
            <Button type="button" onClick={saveEventsCopy} disabled={locked}>{saving ? "Saving…" : busyUploads ? "Uploading…" : "Save page text"}</Button>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-brand-green-dark">Events</h4>
              <Button type="button" size="sm" disabled={locked} onClick={() => { setEventForm(emptyEvent); setEditingEventId(null); setShowEventForm(true); }}>
                <PlusIcon className="mr-1 h-4 w-4" /> Add event
              </Button>
            </div>
            {showEventForm && (
              <EventEditor
                key={editingEventId ?? "new"}
                form={eventForm}
                setForm={setEventForm}
                password={password}
                username={username}
                saving={locked}
                uploading={busyUploads > 0}
                onBusy={onBusy}
                onSave={saveEvent}
                onCancel={() => { setShowEventForm(false); setEditingEventId(null); }}
              />
            )}
            <EventList
              title="Upcoming"
              rows={upcoming}
              locked={locked}
              onEdit={(row) => {
                setEventForm({
                  date: row.date, title: row.title, description: row.description,
                  tags: parseJsonArray(row.tags).join(", "), isPast: false,
                  coverUrl: row.coverUrl, photos: parseJsonArray(row.photos),
                });
                setEditingEventId(row.id);
                setShowEventForm(true);
              }}
              onDelete={async (row) => {
                if (!confirm(`Delete “${row.title}”?`)) return;
                await deleteItem("deleteEvent", row.id, "Event deleted");
              }}
            />
            <EventList
              title="Past"
              rows={past}
              locked={locked}
              onEdit={(row) => {
                setEventForm({
                  date: row.date, title: row.title, description: row.description,
                  tags: parseJsonArray(row.tags).join(", "), isPast: true,
                  coverUrl: row.coverUrl, photos: parseJsonArray(row.photos),
                });
                setEditingEventId(row.id);
                setShowEventForm(true);
              }}
              onDelete={async (row) => {
                if (!confirm(`Delete “${row.title}”?`)) return;
                await deleteItem("deleteEvent", row.id, "Event deleted");
              }}
            />
          </section>
        </div>
      )}

      {tab === "community" && (
        <div className="space-y-8">
          <section className="space-y-4 rounded-xl border border-brand-mist bg-white p-4 md:p-6">
            <h4 className="font-semibold text-brand-green-dark">Page text</h4>
            <Field label="Hero title" value={communityCopy.hero.title} onChange={(v) => setCommunityCopy({ ...communityCopy, hero: { ...communityCopy.hero, title: v } })} />
            <Area label="Hero subtitle" value={communityCopy.hero.subtitle} onChange={(v) => setCommunityCopy({ ...communityCopy, hero: { ...communityCopy.hero, subtitle: v } })} />
            <SiteImageField label="Hero still (reduced-motion fallback — looping video is not edited here)" value={communityCopy.hero.ribbonImage} kind="hero" folder="heroes" password={password} username={username} onBusy={onBusy} onChange={(url) => setCommunityCopy((prev) => ({ ...prev, hero: { ...prev.hero, ribbonImage: url } }))} />
            <Field label="Intro title" value={communityCopy.intro.title} onChange={(v) => setCommunityCopy({ ...communityCopy, intro: { ...communityCopy.intro, title: v } })} />
            <Area label="Intro paragraph" value={communityCopy.intro.paragraph} onChange={(v) => setCommunityCopy({ ...communityCopy, intro: { ...communityCopy.intro, paragraph: v } })} />
            <Field label="Activities title" value={communityCopy.activities.title} onChange={(v) => setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, title: v } })} />
            <Field label="Activities subtitle" value={communityCopy.activities.subtitle} onChange={(v) => setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, subtitle: v } })} />
            <Field label="Activity badges (comma separated)" value={communityCopy.activities.badges.join(", ")} onChange={(v) => setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, badges: v.split(",").map((s) => s.trim()).filter(Boolean) } })} />
            <Field label="Weekly rhythm title" value={communityCopy.activities.rhythmTitle} onChange={(v) => setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, rhythmTitle: v } })} />
            <Area label="Weekly rhythm intro" value={communityCopy.activities.rhythmIntro} onChange={(v) => setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, rhythmIntro: v } })} />
            <div className="space-y-2">
              <Label>Weekly schedule</Label>
              {communityCopy.activities.weekly.map((w, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <Input value={w.label} onChange={(e) => {
                    const weekly = communityCopy.activities.weekly.map((row, idx) => idx === i ? { ...row, label: e.target.value } : row);
                    setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, weekly } });
                  }} />
                  <Input value={w.text} onChange={(e) => {
                    const weekly = communityCopy.activities.weekly.map((row, idx) => idx === i ? { ...row, text: e.target.value } : row);
                    setCommunityCopy({ ...communityCopy, activities: { ...communityCopy.activities, weekly } });
                  }} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <Label>Special event cards</Label>
              {communityCopy.specialEvents.cards.map((c, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-brand-mist p-3">
                  <Input value={c.title} onChange={(e) => {
                    const cards = communityCopy.specialEvents.cards.map((row, idx) => idx === i ? { ...row, title: e.target.value } : row);
                    setCommunityCopy({ ...communityCopy, specialEvents: { ...communityCopy.specialEvents, cards } });
                  }} />
                  <Textarea value={c.description} onChange={(e) => {
                    const cards = communityCopy.specialEvents.cards.map((row, idx) => idx === i ? { ...row, description: e.target.value } : row);
                    setCommunityCopy({ ...communityCopy, specialEvents: { ...communityCopy.specialEvents, cards } });
                  }} />
                </div>
              ))}
            </div>
            <Button type="button" onClick={saveCommunityCopy} disabled={locked}>{saving ? "Saving…" : busyUploads ? "Uploading…" : "Save page text"}</Button>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-brand-green-dark">Common spaces</h4>
              <Button type="button" size="sm" disabled={locked} onClick={() => { setSpaceForm(emptySpace); setEditingSpaceId(null); setShowSpaceForm(true); }}>
                <PlusIcon className="mr-1 h-4 w-4" /> Add space
              </Button>
            </div>
            {showSpaceForm && (
              <div key={editingSpaceId ?? "new"} className="space-y-3 rounded-xl border border-brand-mist bg-white p-4">
                <Field label="Title" value={spaceForm.title} onChange={(v) => setSpaceForm({ ...spaceForm, title: v })} />
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <select
                    className="h-10 w-full rounded-md border border-brand-mist bg-white px-3 text-sm"
                    value={spaceForm.icon}
                    onChange={(e) => setSpaceForm({ ...spaceForm, icon: e.target.value })}
                  >
                    {ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <Area label="Description" value={spaceForm.description} onChange={(v) => setSpaceForm({ ...spaceForm, description: v })} />
                <SiteImageField label="Cover photo" value={spaceForm.imageUrl} kind="card" folder="community" password={password} username={username} onBusy={onBusy} onChange={(url) => setSpaceForm((prev) => ({ ...prev, imageUrl: url, photos: url ? [url] : [] }))} />
                <div className="flex gap-2">
                  <Button type="button" onClick={saveSpace} disabled={locked}>{saving ? "Saving…" : busyUploads ? "Uploading…" : editingSpaceId ? "Save space" : "Add space"}</Button>
                  <Button type="button" variant="outline" disabled={locked} onClick={() => { setShowSpaceForm(false); setEditingSpaceId(null); }}>Cancel</Button>
                </div>
              </div>
            )}
            {spaces.length === 0 ? <p className="text-sm text-brand-green-dark/50">None yet.</p> : null}
            <ul className="space-y-2">
              {spaces.map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-xl border border-brand-mist bg-white p-3">
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" className="h-14 w-20 rounded-md object-cover" />
                  ) : <div className="h-14 w-20 rounded-md bg-brand-sand" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-green-dark">{row.title}</p>
                    <p className="truncate text-xs text-brand-green-dark/60">{row.description}</p>
                  </div>
                  <Button type="button" size="icon-sm" variant="ghost" disabled={locked} onClick={() => {
                    setSpaceForm({
                      title: row.title, icon: row.icon, description: row.description,
                      imageUrl: row.imageUrl, photos: parseJsonArray(row.photos),
                    });
                    setEditingSpaceId(row.id);
                    setShowSpaceForm(true);
                  }}><PencilIcon className="h-4 w-4" /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" disabled={locked} onClick={async () => {
                    if (!confirm(`Delete “${row.title}”?`)) return;
                    await deleteItem("deleteSpace", row.id, "Space deleted");
                  }}><Trash2Icon className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function EventEditor({
  form, setForm, password, username, saving, uploading, onBusy, onSave, onCancel,
}: {
  form: EventForm;
  setForm: Dispatch<SetStateAction<EventForm>>;
  password: string;
  username?: string;
  saving: boolean;
  uploading: boolean;
  onBusy: (busy: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-brand-mist bg-white p-4">
      <Field label="Date (as shown on the card)" value={form.date} onChange={(v) => setForm((prev) => ({ ...prev, date: v }))} />
      <Field label="Title" value={form.title} onChange={(v) => setForm((prev) => ({ ...prev, title: v }))} />
      <Area label="Description" value={form.description} onChange={(v) => setForm((prev) => ({ ...prev, description: v }))} />
      <Field label="Tags (comma separated)" value={form.tags} onChange={(v) => setForm((prev) => ({ ...prev, tags: v }))} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isPast} onChange={(e) => setForm((prev) => ({ ...prev, isPast: e.target.checked }))} />
        Past event (moves it to “Memories”)
      </label>
      <SiteImageField
        label="Cover photo"
        value={form.coverUrl}
        kind="card"
        folder="events"
        password={password}
        username={username}
        onBusy={onBusy}
        onChange={(url) => setForm((prev) => ({ ...prev, coverUrl: url, photos: url ? [url] : [] }))}
      />
      <div className="flex gap-2">
        <Button type="button" onClick={onSave} disabled={saving}>{saving && !uploading ? "Saving…" : uploading ? "Uploading…" : "Save event"}</Button>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function EventList({
  title, rows, locked, onEdit, onDelete,
}: {
  title: string;
  rows: EventRow[];
  locked: boolean;
  onEdit: (row: EventRow) => void;
  onDelete: (row: EventRow) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green-dark/50">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-brand-green-dark/50">None yet.</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 rounded-xl border border-brand-mist bg-white p-3">
            {row.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.coverUrl} alt="" className="h-14 w-20 rounded-md object-cover" />
            ) : <div className="h-14 w-20 rounded-md bg-brand-sand" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-brand-green-dark">{row.title}</p>
              <p className="text-xs text-brand-red">{row.date}</p>
            </div>
            <Button type="button" size="icon-sm" variant="ghost" disabled={locked} onClick={() => onEdit(row)}><PencilIcon className="h-4 w-4" /></Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={locked} onClick={() => onDelete(row)}><Trash2Icon className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
