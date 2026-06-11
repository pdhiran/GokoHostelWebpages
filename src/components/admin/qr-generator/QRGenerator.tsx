"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  QrCodeIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
  DownloadIcon,
  Loader2Icon,
  HistoryIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQRCode } from "./useQRCode";
import { ColorControls } from "./ColorControls";
import { LogoUploader } from "./LogoUploader";
import { TextControls } from "./TextControls";
import { ExportPanel } from "./ExportPanel";
import { QRPreview } from "./QRPreview";
import {
  DEFAULT_CONFIG,
  PRESETS,
  type QRConfig,
  type QRStyle,
  type QRCornerStyle,
  type ErrorCorrectionLevel,
  type QRPresetType,
  type QRHistoryItem,
} from "./types";
import type { Role } from "../types";

const QR_STYLES: { id: QRStyle; label: string }[] = [
  { id: "squares", label: "Square" },
  { id: "dots", label: "Dots" },
  { id: "rounded", label: "Rounded" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Modern" },
];

const CORNER_STYLES: { id: QRCornerStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "dot", label: "Rounded" },
  { id: "extra-rounded", label: "Extra Round" },
];

const ERROR_LEVELS: { id: ErrorCorrectionLevel; label: string; desc: string }[] = [
  { id: "L", label: "L", desc: "7% recovery" },
  { id: "M", label: "M", desc: "15% recovery" },
  { id: "Q", label: "Q", desc: "25% recovery" },
  { id: "H", label: "H", desc: "30% recovery" },
];

export function QRGenerator({ password, username, role }: { password: string; username?: string; role: Role }) {
  const [config, setConfig] = useState<QRConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<QRHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const { containerRef, ready, downloadPNG, downloadSVG, getDataUrl, getPreviewDataUrl } = useQRCode(config);
  const saveNameInputRef = useRef<HTMLInputElement>(null);

  const updateConfig = useCallback((partial: Partial<QRConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/qr-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username, action: "list" }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items || []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [password, username]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  const saveToHistory = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      let dataUrl = "";
      try { dataUrl = await getPreviewDataUrl(); } catch { /* ignore preview failures */ }

      let logoDataUrl = "";
      if (config.logoFile) {
        logoDataUrl = await fileToDataUrl(config.logoFile);
      } else if (config.logoUrl) {
        if (config.logoUrl.startsWith("data:")) {
          logoDataUrl = config.logoUrl;
        } else {
          logoDataUrl = await blobUrlToDataUrl(config.logoUrl);
        }
      }

      const configToSave = { ...config, logoFile: null, logoUrl: logoDataUrl };
      const res = await fetch("/api/admin/qr-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          username,
          action: "save",
          name: saveName.trim(),
          config: JSON.stringify(configToSave),
          previewDataUrl: dataUrl || "",
        }),
      });
      if (res.ok) {
        setSaveName("");
        setShowHistory(true);
        await loadHistory();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteFromHistory = async (id: number) => {
    if (!confirm("Delete this QR configuration?")) return;
    await fetch("/api/admin/qr-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, action: "delete", id }),
    });
    loadHistory();
  };

  const loadFromHistory = (item: QRHistoryItem) => {
    try {
      const parsed = JSON.parse(item.config) as QRConfig;
      setConfig({ ...parsed, logoFile: null, logoUrl: parsed.logoUrl || "" });
      setShowHistory(false);
    } catch { /* ignore */ }
  };

  const downloadFromHistory = async (item: QRHistoryItem) => {
    try {
      const parsed = JSON.parse(item.config) as QRConfig;
      const tempConfig = { ...parsed, logoFile: null, logoUrl: parsed.logoUrl || "" };
      const { default: QRCodeStylingLib } = await import("qr-code-styling");
      const exportSize = Math.max(tempConfig.size, 2048);
      const exportMargin = Math.round(tempConfig.margin * (exportSize / tempConfig.size));
      const errorLevel = tempConfig.logoUrl ? "H" : tempConfig.errorCorrection;
      const options: any = {
        width: exportSize,
        height: exportSize,
        margin: exportMargin,
        data: tempConfig.data || " ",
        dotsOptions: {
          type: tempConfig.style === "dots" ? "dots" : tempConfig.style === "rounded" ? "rounded" : tempConfig.style === "classy" ? "classy" : tempConfig.style === "classy-rounded" ? "classy-rounded" : "square",
          ...(tempConfig.gradient.type !== "none"
            ? { gradient: { type: tempConfig.gradient.type, rotation: tempConfig.gradient.rotation || 0, colorStops: [{ offset: 0, color: tempConfig.gradient.colorStart }, { offset: 1, color: tempConfig.gradient.colorEnd }] } }
            : { color: tempConfig.fgColor }),
        },
        backgroundOptions: { color: tempConfig.bgColor },
        cornersSquareOptions: { type: tempConfig.cornerStyle === "dot" ? "dot" : tempConfig.cornerStyle === "extra-rounded" ? "extra-rounded" : "square" },
        cornersDotOptions: { type: tempConfig.cornerStyle === "dot" ? "dot" : tempConfig.cornerStyle === "extra-rounded" ? "extra-rounded" : "square" },
        qrOptions: { errorCorrectionLevel: errorLevel },
      };
      if (tempConfig.logoUrl) {
        options.image = tempConfig.logoUrl;
        options.imageOptions = { crossOrigin: "anonymous", margin: tempConfig.logoMargin, imageSize: tempConfig.logoSize / 100, hideBackgroundDots: tempConfig.logoBgEnabled };
      }
      const instance = new QRCodeStylingLib(options);
      await instance.download({ name: item.name || "goko-qr", extension: "png" });
    } catch { /* ignore */ }
  };

  const applyPreset = (presetId: QRPresetType) => {
    const preset = PRESETS[presetId];
    const { label, description, ...values } = preset;
    setConfig((prev) => ({ ...prev, ...values }));
  };

  const handleSaveConfig = () => {
    setShowHistory(true);
    setTimeout(() => {
      saveNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      saveNameInputRef.current?.focus();
    }, 100);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <QrCodeIcon className="h-5 w-5 text-brand-green" />
          <h2 className="text-lg font-bold text-brand-green-dark">QR Code Generator</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowHistory(!showHistory)}
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            History
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="rounded-xl border border-brand-mist bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-green-dark">Saved QR Codes</h3>
            {loadingHistory && <Loader2Icon className="h-4 w-4 animate-spin text-brand-green" />}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-brand-green-dark/50 py-4 text-center">No saved QR codes yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-brand-mist p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-center rounded-md bg-brand-sand/20 p-3">
                    {item.previewDataUrl ? (
                      <img src={item.previewDataUrl} alt={item.name} className="h-24 w-24 object-contain" />
                    ) : (
                      <QrCodeIcon className="h-16 w-16 text-brand-green/20" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-brand-green-dark">{item.name}</p>
                      <p className="text-[10px] text-brand-green-dark/40">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFromHistory(item.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => loadFromHistory(item)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-brand-green/20 bg-brand-green/5 px-3 py-2 text-xs font-medium text-brand-green transition-colors hover:bg-brand-green/10"
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      Load &amp; Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFromHistory(item)}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-brand-mist bg-white px-3 py-2 text-xs font-medium text-brand-green-dark/70 transition-colors hover:bg-brand-sand/50"
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save Current */}
          <div className="mt-3 flex gap-2 border-t border-brand-mist pt-3">
            <input
              ref={saveNameInputRef}
              type="text"
              placeholder="Name this QR config..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="h-8 flex-1 rounded-md border border-brand-mist bg-white px-3 text-xs focus:border-brand-green focus:outline-none"
            />
            <Button
              type="button"
              onClick={saveToHistory}
              disabled={!saveName.trim() || saving}
              className="h-8 gap-1.5 text-xs"
            >
              {saving ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Preset Templates */}
      <div className="rounded-xl border border-brand-mist bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <LayoutTemplateIcon className="h-4 w-4 text-brand-green" />
          <h3 className="text-sm font-semibold text-brand-green-dark">Quick Templates</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(PRESETS) as QRPresetType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-lg border border-brand-mist p-3 text-left transition-all hover:border-brand-green/40 hover:bg-brand-green/5"
            >
              <p className="text-xs font-medium text-brand-green-dark">{PRESETS[key].label}</p>
              <p className="mt-0.5 text-[10px] text-brand-green-dark/50">{PRESETS[key].description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Controls */}
        <div className="space-y-5">
          {/* Data Input */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <h3 className="text-sm font-semibold text-brand-green-dark mb-3">QR Content</h3>
            <textarea
              value={config.data}
              onChange={(e) => updateConfig({ data: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-sm resize-none focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green/30 font-mono"
              placeholder="Enter URL, text, WiFi credentials, vCard data..."
            />
          </div>

          {/* Style Options */}
          <div className="rounded-xl border border-brand-mist bg-white p-4 space-y-4">
            <h3 className="text-sm font-semibold text-brand-green-dark">QR Style</h3>

            {/* Dot Style */}
            <div>
              <label className="text-xs font-medium text-brand-green-dark/70">Module Style</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {QR_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateConfig({ style: s.id })}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      config.style === s.id
                        ? "bg-brand-green/10 text-brand-green ring-1 ring-brand-green/30"
                        : "text-brand-green-dark/60 hover:bg-brand-sand/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Corner Style */}
            <div>
              <label className="text-xs font-medium text-brand-green-dark/70">Corner Style</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CORNER_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateConfig({ cornerStyle: s.id })}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      config.cornerStyle === s.id
                        ? "bg-brand-green/10 text-brand-green ring-1 ring-brand-green/30"
                        : "text-brand-green-dark/60 hover:bg-brand-sand/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Correction */}
            <div>
              <label className="text-xs font-medium text-brand-green-dark/70">Error Correction</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ERROR_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => updateConfig({ errorCorrection: l.id })}
                    className={`flex flex-col items-center rounded-md px-3 py-1.5 text-xs transition-colors ${
                      config.errorCorrection === l.id
                        ? "bg-brand-green/10 text-brand-green ring-1 ring-brand-green/30"
                        : "text-brand-green-dark/60 hover:bg-brand-sand/50"
                    }`}
                    title={l.desc}
                  >
                    <span className="font-medium">{l.label}</span>
                    <span className="text-[9px] opacity-60">{l.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size & Margin */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-brand-green-dark/70">
                  Size ({config.size}px)
                </label>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="50"
                  value={config.size}
                  onChange={(e) => updateConfig({ size: Number(e.target.value) })}
                  className="mt-1 w-full accent-brand-green"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-brand-green-dark/70">
                  Margin ({config.margin}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={config.margin}
                  onChange={(e) => updateConfig({ margin: Number(e.target.value) })}
                  className="mt-1 w-full accent-brand-green"
                />
              </div>
            </div>
          </div>

          {/* Color Controls */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <ColorControls config={config} onChange={updateConfig} />
          </div>

          {/* Logo Uploader */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <LogoUploader config={config} onChange={updateConfig} />
          </div>

          {/* Text Controls */}
          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <TextControls config={config} onChange={updateConfig} />
          </div>
        </div>

        {/* Preview & Export Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-brand-mist bg-gradient-to-b from-brand-sand/20 to-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-brand-green" />
              <h3 className="text-sm font-semibold text-brand-green-dark">Live Preview</h3>
            </div>
            <QRPreview containerRef={containerRef} config={config} ready={ready} />
          </div>

          <div className="rounded-xl border border-brand-mist bg-white p-4">
            <ExportPanel
              config={config}
              downloadPNG={downloadPNG}
              downloadSVG={downloadSVG}
              getDataUrl={getDataUrl}
              onSaveConfig={handleSaveConfig}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
