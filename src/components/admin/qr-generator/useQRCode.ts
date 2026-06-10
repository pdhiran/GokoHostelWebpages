"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { QRConfig } from "./types";

type QRCodeStylingType = any;

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

  useEffect(() => {
    if (!QRCodeStyling || !containerRef.current) return;

    const errorLevel = config.logoFile || config.logoUrl ? "H" : config.errorCorrection;

    const options: any = {
      width: config.size,
      height: config.size,
      margin: config.margin,
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

  const downloadPNG = useCallback(async () => {
    if (!qrRef.current) return;
    await qrRef.current.download({ name: "goko-qr", extension: "png" });
  }, []);

  const downloadSVG = useCallback(async () => {
    if (!qrRef.current) return;
    await qrRef.current.download({ name: "goko-qr", extension: "svg" });
  }, []);

  const getDataUrl = useCallback(async (): Promise<string> => {
    if (!qrRef.current) return "";
    const blob = await qrRef.current.getRawData("png");
    if (!blob) return "";
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, []);

  return { containerRef, ready, downloadPNG, downloadSVG, getDataUrl };
}
