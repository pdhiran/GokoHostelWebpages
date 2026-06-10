"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { QRConfig } from "./types";

type QRCodeStylingType = any;

const HD_EXPORT_SIZE = 2048;
const PREVIEW_MAX_SIZE = 400;

function getDotsType(style: QRConfig["style"]): string {
  switch (style) {
    case "dots": return "dots";
    case "rounded": return "rounded";
    case "classy": return "classy";
    case "classy-rounded": return "classy-rounded";
    default: return "square";
  }
}

function getCornerType(corner: QRConfig["cornerStyle"]): string {
  switch (corner) {
    case "dot": return "dot";
    case "extra-rounded": return "extra-rounded";
    default: return "square";
  }
}

function buildOptions(config: QRConfig, size: number, margin: number): any {
  const errorLevel = config.logoFile || config.logoUrl ? "H" : config.errorCorrection;

  const options: any = {
    width: size,
    height: size,
    margin,
    data: config.data || " ",
    dotsOptions: {
      type: getDotsType(config.style),
      ...(config.gradient.type !== "none"
        ? {
            gradient: {
              type: config.gradient.type,
              rotation: config.gradient.rotation || 0,
              colorStops: [
                { offset: 0, color: config.gradient.colorStart },
                { offset: 1, color: config.gradient.colorEnd },
              ],
            },
          }
        : { color: config.fgColor }),
    },
    backgroundOptions: { color: config.bgColor },
    cornersSquareOptions: { type: getCornerType(config.cornerStyle) },
    cornersDotOptions: { type: getCornerType(config.cornerStyle) },
    qrOptions: { errorCorrectionLevel: errorLevel },
  };

  if (config.logoFile || config.logoUrl) {
    options.image = config.logoUrl || undefined;
    options.imageOptions = {
      crossOrigin: "anonymous",
      margin: config.logoMargin,
      imageSize: config.logoSize / 100,
      hideBackgroundDots: config.logoBgEnabled,
    };
  }

  return options;
}

export function useQRCode(config: QRConfig) {
  const qrRef = useRef<QRCodeStylingType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [QRCodeStyling, setQRCodeStyling] = useState<any>(null);

  useEffect(() => {
    import("qr-code-styling").then((mod) => {
      setQRCodeStyling(() => mod.default);
    });
  }, []);

  // Preview uses capped size for smooth UI
  useEffect(() => {
    if (!QRCodeStyling || !containerRef.current) return;

    const previewSize = Math.min(config.size, PREVIEW_MAX_SIZE);
    const previewMargin = Math.round(config.margin * (previewSize / config.size));
    const options = buildOptions(config, previewSize, previewMargin);

    if (qrRef.current) {
      qrRef.current.update(options);
    } else {
      qrRef.current = new QRCodeStyling(options);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        qrRef.current.append(containerRef.current);
      }
    }

    setReady(true);
  }, [QRCodeStyling, config]);

  // Creates an HD instance for export at configured size (minimum 1024px)
  const createHDInstance = useCallback(async () => {
    if (!QRCodeStyling) return null;
    const exportSize = Math.max(config.size, HD_EXPORT_SIZE);
    const exportMargin = Math.round(config.margin * (exportSize / config.size));
    const options = buildOptions(config, exportSize, exportMargin);
    return new QRCodeStyling(options);
  }, [QRCodeStyling, config]);

  const getPreviewDataUrl = useCallback(async (): Promise<string> => {
    if (!QRCodeStyling) return "";
    const options = buildOptions(config, 200, Math.round(config.margin * (200 / config.size)));
    const instance = new QRCodeStyling(options);
    const blob = await instance.getRawData("png");
    if (!blob) return "";
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, [QRCodeStyling, config]);

  const downloadPNG = useCallback(async () => {
    const hd = await createHDInstance();
    if (!hd) return;
    await hd.download({ name: "goko-qr", extension: "png" });
  }, [createHDInstance]);

  const downloadSVG = useCallback(async () => {
    const hd = await createHDInstance();
    if (!hd) return;
    await hd.download({ name: "goko-qr", extension: "svg" });
  }, [createHDInstance]);

  const getDataUrl = useCallback(async (): Promise<string> => {
    const hd = await createHDInstance();
    if (!hd) return "";
    const blob = await hd.getRawData("png");
    if (!blob) return "";
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, [createHDInstance]);

  return { containerRef, ready, downloadPNG, downloadSVG, getDataUrl, getPreviewDataUrl };
}
