"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  UploadIcon,
  DownloadIcon,
  Loader2Icon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileSpreadsheetIcon,
  XIcon,
} from "lucide-react";
import type { Role } from "./types";

type ImportResults = {
  total: number;
  inserted: number;
  skipped: number;
  failed: { row: number; reason: string }[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function isExcelFile(file: File): boolean {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.endsWith(".xlsx")
  );
}

function validateFile(f: File): string | null {
  if (!isExcelFile(f)) return "Please upload an .xlsx file";
  if (f.size > MAX_FILE_SIZE) return "File too large (max 5 MB)";
  return null;
}

export function AdminBulkImport({
  password,
  role,
}: {
  password: string;
  username?: string;
  role: Role;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    const err = validateFile(droppedFile);
    if (err) {
      setError(err);
    } else {
      setFile(droppedFile);
      setResults(null);
      setError(null);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  if (role !== "admin") {
    return (
      <p className="py-10 text-center text-brand-green-dark/50">
        Only admins can upload historical data.
      </p>
    );
  }

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action: "template" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download template");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "checkin_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const err = validateFile(selected);
    if (err) {
      setError(err);
    } else {
      setFile(selected);
      setResults(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    setResults(null);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("password", password);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResults(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-brand-green-dark">
        Bulk Upload Historical Data
      </h3>

      {/* Step 1: Download Template */}
      <div className="rounded-2xl border border-brand-mist bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10">
            <DownloadIcon className="h-6 w-6 text-brand-green" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-brand-green-dark">
              Step 1: Download Template
            </h4>
            <p className="mt-1 text-sm text-brand-green-dark/60">
              Download the Excel template with pre-defined column headings. Fill
              in your historical check-in data under the columns, then upload it
              below.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    Download Template (.xlsx)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Upload filled Excel */}
      <div className="rounded-2xl border border-brand-mist bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green/10">
            <UploadIcon className="h-6 w-6 text-brand-green" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-brand-green-dark">
              Step 2: Upload Filled Excel
            </h4>
            <p className="mt-1 text-sm text-brand-green-dark/60">
              Upload the filled template. The system will validate, skip
              duplicates, and insert new records.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="File upload drop zone. Press Enter or Space to browse files."
          className={`mt-4 rounded-xl border-2 border-dashed p-4 sm:p-8 text-center transition-colors ${
            dragActive
              ? "border-brand-green bg-brand-green/5"
              : "border-brand-mist hover:border-brand-green/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheetIcon className="h-8 w-8 text-brand-green" aria-hidden="true" />
              <div className="text-left">
                <p className="text-sm font-medium text-brand-green-dark">
                  {file.name}
                </p>
                <p className="text-xs text-brand-green-dark/50">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove selected file"
                className="ml-2 rounded-lg p-1 text-brand-green-dark/40 hover:bg-red-50 hover:text-red-500"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <FileSpreadsheetIcon className="mx-auto h-10 w-10 text-brand-green-dark/30" aria-hidden="true" />
              <p className="mt-2 text-sm text-brand-green-dark/60">
                Drag & drop your filled Excel file here, or
              </p>
              <label
                htmlFor="bulk-import-file"
                className="mt-2 inline-block cursor-pointer rounded-lg bg-brand-green/10 px-4 py-2 text-sm font-medium text-brand-green hover:bg-brand-green/20"
              >
                Browse files
              </label>
              <input
                ref={fileInputRef}
                id="bulk-import-file"
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={handleFileChange}
                aria-label="Upload Excel file"
              />
            </>
          )}
        </div>

        {/* Import button */}
        {file && !results && (
          <div className="mt-4">
            <Button
              type="button"
              variant="cta"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Importing...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Import Records
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircleIcon className="mr-1 inline h-4 w-4" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Results display */}
      {results && (
        <div className="rounded-2xl border border-brand-mist bg-white p-4 sm:p-6 shadow-sm">
          <h4 className="font-medium text-brand-green-dark">Import Results</h4>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-700">
                {results.inserted}
              </p>
              <p className="text-xs text-green-600">Inserted</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-amber-700">
                {results.skipped}
              </p>
              <p className="text-xs text-amber-600">Skipped (duplicates)</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-red-700">
                {results.failed.length}
              </p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>

          {results.inserted > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700">
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Successfully imported {results.inserted} of {results.total}{" "}
              records.
            </div>
          )}

          {results.failed.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-700">
                Failed rows ({results.failed.length}):
              </p>
              <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-red-200">
                <table className="w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-red-700">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-red-700">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.failed.map((f, idx) => (
                      <tr key={idx} className="border-t border-red-100">
                        <td className="px-3 py-2 text-red-600">{f.row}</td>
                        <td className="px-3 py-2 text-red-600">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-brand-green-dark/50">
                Fix these rows in your Excel and re-upload. Already-imported rows
                will be skipped automatically.
              </p>
            </div>
          )}

          {/* Upload another */}
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={clearFile}>
              Upload Another File
            </Button>
          </div>
        </div>
      )}

      {/* Help section */}
      <div className="rounded-xl bg-brand-sand/50 p-4 text-xs text-brand-green-dark/60">
        <p className="font-medium">How it works:</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Download the template, fill your data under the column headings</li>
          <li>For ID photos, paste the Google Drive URL in the id_card_link column</li>
          <li>Multiple photo links can be separated with a pipe character ( | )</li>
          <li>Required fields: first_name, last_name, contact, arrival_date</li>
          <li>Historical records default to &quot;checked_out&quot; status</li>
          <li>
            <strong>Safe retries:</strong> Re-uploading the same file skips
            already-imported rows (matched by name + contact + arrival_date)
          </li>
        </ul>
      </div>
    </div>
  );
}
