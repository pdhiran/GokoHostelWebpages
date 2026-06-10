"use client";

import { COLOR_PRESETS } from "./types";
import type { QRConfig, QRGradient, GradientType } from "./types";

interface Props {
  config: QRConfig;
  onChange: (partial: Partial<QRConfig>) => void;
}

export function ColorControls({ config, onChange }: Props) {
  const updateGradient = (partial: Partial<QRGradient>) => {
    onChange({ gradient: { ...config.gradient, ...partial } });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-brand-green-dark">Colors & Style</h3>

      {/* Foreground Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-brand-green-dark/70">Foreground Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={config.fgColor}
            onChange={(e) => onChange({ fgColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-brand-mist"
          />
          <input
            type="text"
            value={config.fgColor}
            onChange={(e) => onChange({ fgColor: e.target.value })}
            className="h-8 flex-1 rounded-md border border-brand-mist bg-white px-2 text-xs font-mono"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ fgColor: c })}
              className="h-5 w-5 rounded-sm border border-brand-mist transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-brand-green-dark/70">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={config.bgColor}
            onChange={(e) => onChange({ bgColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-brand-mist"
          />
          <input
            type="text"
            value={config.bgColor}
            onChange={(e) => onChange({ bgColor: e.target.value })}
            className="h-8 flex-1 rounded-md border border-brand-mist bg-white px-2 text-xs font-mono"
          />
        </div>
      </div>

      {/* Gradient */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-brand-green-dark/70">Gradient</label>
        <div className="flex gap-1.5">
          {(["none", "linear", "radial"] as GradientType[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => updateGradient({ type: g })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                config.gradient.type === g
                  ? "bg-brand-green/10 text-brand-green"
                  : "text-brand-green-dark/60 hover:bg-brand-sand/50"
              }`}
            >
              {g === "none" ? "None" : g === "linear" ? "Linear" : "Radial"}
            </button>
          ))}
        </div>

        {config.gradient.type !== "none" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-brand-green-dark/50">Start</label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={config.gradient.colorStart}
                  onChange={(e) => updateGradient({ colorStart: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded border border-brand-mist"
                />
                <span className="text-[10px] font-mono text-brand-green-dark/50">{config.gradient.colorStart}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-brand-green-dark/50">End</label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={config.gradient.colorEnd}
                  onChange={(e) => updateGradient({ colorEnd: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded border border-brand-mist"
                />
                <span className="text-[10px] font-mono text-brand-green-dark/50">{config.gradient.colorEnd}</span>
              </div>
            </div>
            {config.gradient.type === "linear" && (
              <div className="col-span-2">
                <label className="text-[10px] text-brand-green-dark/50">Rotation ({config.gradient.rotation || 0}°)</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={config.gradient.rotation || 0}
                  onChange={(e) => updateGradient({ rotation: Number(e.target.value) })}
                  className="w-full accent-brand-green"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
