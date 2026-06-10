"use client";

import type { QRConfig } from "./types";

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  config: QRConfig;
  ready: boolean;
}

export function QRPreview({ containerRef, config, ready }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-xl border border-brand-mist bg-white p-4 sm:p-6 shadow-sm">
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
          </div>
        )}
        <div
          ref={containerRef}
          className="flex items-center justify-center overflow-hidden"
          style={{ maxWidth: "100%", maxHeight: 400 }}
        />
        {config.textEnabled && config.text && (
          <div className="mt-3 text-center">
            {config.text.split("\n").map((line, i) => (
              <p
                key={i}
                style={{
                  fontSize: config.textFontSize,
                  fontFamily: config.textFontFamily,
                  color: config.textColor,
                }}
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] text-brand-green-dark/40">
          {config.size}×{config.size}px • Error correction: {config.errorCorrection}
          {(config.logoFile || config.logoUrl) ? " (H - logo mode)" : ""}
        </p>
      </div>
    </div>
  );
}
