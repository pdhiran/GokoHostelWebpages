"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { isMediaUrl } from "@/lib/mediaKeys";
import { processSiteImage } from "@/lib/processSiteImage";
import type { SiteImageKind } from "@/lib/cropRect";

export function SiteImageField({
  label,
  value,
  kind,
  folder,
  password,
  username,
  onChange,
  onBusy,
}: {
  label: string;
  value: string;
  kind: SiteImageKind;
  folder: "events" | "community" | "heroes";
  password: string;
  username?: string;
  onChange: (url: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef<string | null>(null);
  const wasBusy = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!onBusy) return;
    if (busy && !wasBusy.current) onBusy(true);
    if (!busy && wasBusy.current) onBusy(false);
    wasBusy.current = busy;
    return () => {
      if (wasBusy.current) {
        onBusy(false);
        wasBusy.current = false;
      }
    };
  }, [busy, onBusy]);

  const discardPending = (url: string | null) => {
    if (!url || !isMediaUrl(url)) return;
    const payload: Record<string, unknown> = { password, action: "discardMedia", url };
    if (username) payload.username = username;
    void fetch("/api/admin/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const upload = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const blob = await processSiteImage(file, kind);
      const fd = new FormData();
      fd.append("file", blob, "image.jpg");
      fd.append("password", password);
      if (username) fd.append("username", username);
      fd.append("folder", folder);
      const res = await fetch("/api/admin/website/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!aliveRef.current) {
        discardPending(data.url);
        return;
      }
      if (pendingRef.current && pendingRef.current !== data.url) discardPending(pendingRef.current);
      pendingRef.current = data.url;
      onChange(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not process image");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    if (pendingRef.current) discardPending(pendingRef.current);
    pendingRef.current = null;
    onChange("");
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-brand-mist bg-brand-sand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white disabled:opacity-40"
              onClick={clear}
              disabled={busy}
              aria-label="Remove image"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-mist bg-brand-sand/40 text-xs text-brand-green-dark/50">
            {kind === "hero" ? "16:9" : "16:10"}
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-brand-mist bg-white px-3 py-2 text-sm text-brand-green-dark hover:bg-brand-sand/40">
          {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}
          {busy ? "Formatting…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      <p className="text-xs text-brand-green-dark/55">
        Phone photos are auto-cropped for mobile and desktop. Preview only — save the event, space, or page text to publish.
      </p>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
