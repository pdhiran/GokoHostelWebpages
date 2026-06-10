"use client";

import { useState } from "react";
import { DownloadIcon, CopyIcon, CheckIcon, FileJsonIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import type { QRConfig } from "./types";

interface Props {
  config: QRConfig;
  downloadPNG: () => Promise<void>;
  downloadSVG: () => Promise<void>;
  getDataUrl: () => Promise<string>;
  onSaveConfig: () => void;
}

export function ExportPanel({ config, downloadPNG, downloadSVG, getDataUrl, onSaveConfig }: Props) {
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleCopyToClipboard = async () => {
    setCopying(true);
    try {
      const dataUrl = await getDataUrl();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch {
      // Clipboard API might not be available
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
  };

  const handleDownloadPDF = async () => {
    setExporting("pdf");
    try {
      const dataUrl = await getDataUrl();
      if (!dataUrl) return;

      const imgSize = config.size;
      const margin = 20;
      const textHeight = config.textEnabled ? 40 : 0;
      const pageWidth = imgSize + margin * 2;
      const pageHeight = imgSize + margin * 2 + textHeight;

      const pdf = new jsPDF({
        orientation: pageWidth > pageHeight ? "landscape" : "portrait",
        unit: "px",
        format: [pageWidth, pageHeight],
      });

      pdf.addImage(dataUrl, "PNG", margin, margin, imgSize, imgSize);

      if (config.textEnabled && config.text) {
        pdf.setFontSize(config.textFontSize * 0.75);
        pdf.setTextColor(config.textColor);
        const lines = config.text.split("\n");
        lines.forEach((line, i) => {
          const textWidth = pdf.getTextWidth(line);
          const x = (pageWidth - textWidth) / 2;
          const y = margin + imgSize + 20 + i * (config.textFontSize * 0.75 + 4);
          pdf.text(line, x, y);
        });
      }

      pdf.save("goko-qr.pdf");
    } finally {
      setExporting(null);
    }
  };

  const handlePNG = async () => {
    setExporting("png");
    try {
      await downloadPNG();
    } finally {
      setExporting(null);
    }
  };

  const handleSVG = async () => {
    setExporting("svg");
    try {
      await downloadSVG();
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-brand-green-dark">Export</h3>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={handlePNG}
          disabled={!!exporting}
          className="h-9 gap-1.5 text-xs"
          variant="outline"
        >
          {exporting === "png" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
          PNG
        </Button>
        <Button
          type="button"
          onClick={handleSVG}
          disabled={!!exporting}
          className="h-9 gap-1.5 text-xs"
          variant="outline"
        >
          {exporting === "svg" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
          SVG
        </Button>
        <Button
          type="button"
          onClick={handleDownloadPDF}
          disabled={!!exporting}
          className="h-9 gap-1.5 text-xs"
          variant="outline"
        >
          {exporting === "pdf" ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
          PDF
        </Button>
        <Button
          type="button"
          onClick={handleCopyToClipboard}
          disabled={copying}
          className="h-9 gap-1.5 text-xs"
          variant="outline"
        >
          {copying ? <CheckIcon className="h-3.5 w-3.5 text-green-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copying ? "Copied!" : "Copy"}
        </Button>
      </div>

      <Button
        type="button"
        onClick={onSaveConfig}
        className="h-9 w-full gap-1.5 text-xs"
        variant="outline"
      >
        <FileJsonIcon className="h-3.5 w-3.5" />
        Save Configuration
      </Button>
    </div>
  );
}
