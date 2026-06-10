"use client";

import { FONT_FAMILIES, COLOR_PRESETS } from "./types";
import type { QRConfig } from "./types";

interface Props {
  config: QRConfig;
  onChange: (partial: Partial<QRConfig>) => void;
}

export function TextControls({ config, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-green-dark">Text Overlay</h3>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={config.textEnabled}
            onChange={(e) => onChange({ textEnabled: e.target.checked })}
            className="accent-brand-green"
          />
          <span className="text-[10px] text-brand-green-dark/60">Enable</span>
        </label>
      </div>

      {config.textEnabled && (
        <div className="space-y-3">
          {/* Text Content */}
          <div>
            <label className="text-xs font-medium text-brand-green-dark/70">Text</label>
            <textarea
              value={config.text}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-brand-mist bg-white px-3 py-2 text-xs resize-none focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green/30"
              placeholder="Enter text below QR code..."
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="text-xs font-medium text-brand-green-dark/70">Font</label>
            <select
              value={config.textFontFamily}
              onChange={(e) => onChange({ textFontFamily: e.target.value })}
              className="mt-1 w-full rounded-md border border-brand-mist bg-white px-2 py-1.5 text-xs focus:border-brand-green focus:outline-none"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f.split(",")[0]}</option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-xs font-medium text-brand-green-dark/70">
              Size ({config.textFontSize}px)
            </label>
            <input
              type="range"
              min="10"
              max="48"
              value={config.textFontSize}
              onChange={(e) => onChange({ textFontSize: Number(e.target.value) })}
              className="mt-1 w-full accent-brand-green"
            />
          </div>

          {/* Text Color */}
          <div>
            <label className="text-xs font-medium text-brand-green-dark/70">Color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={config.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-brand-mist"
              />
              <input
                type="text"
                value={config.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="h-7 flex-1 rounded-md border border-brand-mist bg-white px-2 text-[10px] font-mono"
              />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {COLOR_PRESETS.slice(0, 8).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ textColor: c })}
                  className="h-4 w-4 rounded-sm border border-brand-mist transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
