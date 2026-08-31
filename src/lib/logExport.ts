/**
 * Client-safe log download helpers (JSON blob + PDF text).
 * Do not import `@/lib/pmsLog` here — that module writes D1.
 */

import { previousPmsPayload, summarizePmsLog } from "@/lib/pmsLogSummary";

export function prettyJson(raw?: string | null): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type PmsExportRow = {
  direction: string;
  type: string;
  status: string;
  requestPayload?: string | null;
  responsePayload?: string | null;
  errorMessage?: string | null;
  recordsAffected?: number | null;
  createdAt: string;
  httpMethod?: string | null;
  url?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
};

export type SystemExportRow = {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: string;
};

export function formatPmsLogsForPdf(logs: PmsExportRow[], generatedAt = new Date()): string[] {
  const lines = [
    "Goko Hostel — PMS Logs",
    `Generated ${generatedAt.toLocaleString()}`,
    `${logs.length} log(s)`,
    "",
  ];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const summary = summarizePmsLog({
      type: log.type,
      requestPayload: log.requestPayload,
      previousRequestPayload: previousPmsPayload(logs, i),
    });
    const requestText = prettyJson(log.requestPayload);
    const responseText = prettyJson(log.responsePayload);
    lines.push(`--- ${i + 1} of ${logs.length} ---`);
    lines.push(`${log.direction} ${log.type} ${log.status}`);
    if (summary) {
      lines.push("Operation:");
      for (const row of summary.split("\n")) lines.push(row);
    }
    if (log.url) lines.push(`URL: ${log.httpMethod || "POST"} ${log.url}`);
    if (log.httpStatus === 0) lines.push("network error");
    else if (log.httpStatus != null) lines.push(`HTTP ${log.httpStatus}`);
    if (log.durationMs != null) lines.push(`${log.durationMs}ms`);
    if ((log.recordsAffected ?? 0) > 0) lines.push(`${log.recordsAffected} records`);
    lines.push(`Time: ${new Date(log.createdAt).toLocaleString()}`);
    if (log.errorMessage) lines.push(`Error: ${log.errorMessage}`);
    if (requestText) {
      lines.push("Request:");
      for (const row of requestText.split("\n")) lines.push(row);
    }
    if (responseText) {
      lines.push("Response:");
      for (const row of responseText.split("\n")) lines.push(row);
    }
    if (!requestText && !responseText) lines.push("No request or response body stored.");
    lines.push("");
  }
  return lines;
}

export function formatSystemLogsForPdf(logs: SystemExportRow[], generatedAt = new Date()): string[] {
  const lines = [
    "Goko Hostel — System Logs",
    `Generated ${generatedAt.toLocaleString()}`,
    `${logs.length} log(s)`,
    "",
  ];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    lines.push(`--- ${i + 1} of ${logs.length} ---`);
    lines.push(`[${(log.level || "").toUpperCase()}] ${log.message}`);
    lines.push(`Source: ${log.source || "unknown"}`);
    lines.push(`Time: ${new Date(log.timestamp).toLocaleString()}`);
    if (log.details) {
      lines.push("Details:");
      for (const row of log.details.split("\n")) lines.push(row);
    }
    lines.push("");
  }
  return lines;
}

export async function saveTextPdf(filename: string, lines: string[]): Promise<void> {
  const mod = await import("jspdf");
  const JsPDF = typeof mod.jsPDF === "function" ? mod.jsPDF : (mod.default as typeof mod.jsPDF);
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 12;
  const pageH = 297;
  const pageW = 210;
  const maxW = pageW - margin * 2;
  const footer = 10;
  const lineH = 3.5;
  let y = margin;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  for (const raw of lines) {
    const chunks = doc.splitTextToSize(raw.length ? raw : " ", maxW) as string[];
    for (const chunk of chunks) {
      if (y > pageH - margin - footer) {
        doc.addPage();
        y = margin;
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
      }
      doc.text(chunk, margin, y);
      y += lineH;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${p} / ${pages}`, pageW / 2, pageH - 6, { align: "center" });
  }
  doc.save(filename);
}
