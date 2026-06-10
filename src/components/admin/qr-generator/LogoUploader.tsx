"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, XIcon, UploadIcon } from "lucide-react";
import type { QRConfig } from "./types";

interface Props {
  config: QRConfig;
  onChange: (partial: Partial<QRConfig>) => void;
}

export function LogoUploader({ config, onChange }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onChange({ logoFile: file, logoUrl: url });
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const removeLogo = () => {
    if (config.logoUrl) URL.revokeObjectURL(config.logoUrl);
    onChange({ logoFile: null, logoUrl: "" });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-brand-green-dark">Logo / Image</h3>

      {config.logoUrl ? (
        <div className="relative rounded-lg border border-brand-mist p-3">
          <div className="flex items-center gap-3">
            <img
              src={config.logoUrl}
              alt="Logo preview"
              className="h-12 w-12 rounded-md object-contain bg-brand-sand/30"
            />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-brand-green-dark">
                {config.logoFile?.name || "Uploaded logo"}
              </p>
              <p className="text-[10px] text-brand-green-dark/50">
                {config.logoFile ? `${(config.logoFile.size / 1024).toFixed(1)} KB` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={removeLogo}
              className="rounded-full p-1 text-red-500 hover:bg-red-50"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Logo Size */}
          <div className="mt-3 space-y-1">
            <label className="text-[10px] text-brand-green-dark/50">
              Size ({config.logoSize}%)
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={config.logoSize}
              onChange={(e) => onChange({ logoSize: Number(e.target.value) })}
              className="w-full accent-brand-green"
            />
          </div>

          {/* Logo Margin */}
          <div className="mt-2 space-y-1">
            <label className="text-[10px] text-brand-green-dark/50">
              Margin ({config.logoMargin}px)
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={config.logoMargin}
              onChange={(e) => onChange({ logoMargin: Number(e.target.value) })}
              className="w-full accent-brand-green"
            />
          </div>

          {/* Logo Background */}
          <label className="mt-2 flex items-center gap-2 text-xs text-brand-green-dark/70">
            <input
              type="checkbox"
              checked={config.logoBgEnabled}
              onChange={(e) => onChange({ logoBgEnabled: e.target.checked })}
              className="accent-brand-green"
            />
            White background behind logo
          </label>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragActive
              ? "border-brand-green bg-brand-green/5"
              : "border-brand-mist hover:border-brand-green/40 hover:bg-brand-sand/30"
          }`}
        >
          <div className="rounded-full bg-brand-green/10 p-2">
            {dragActive ? (
              <UploadIcon className="h-5 w-5 text-brand-green" />
            ) : (
              <ImageIcon className="h-5 w-5 text-brand-green/60" />
            )}
          </div>
          <p className="text-xs text-brand-green-dark/60 text-center">
            <span className="font-medium text-brand-green">Click to upload</span> or drag & drop
          </p>
          <p className="text-[10px] text-brand-green-dark/40">PNG, JPG, SVG (max 2MB)</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
