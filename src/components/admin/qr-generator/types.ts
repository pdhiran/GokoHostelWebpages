export type QRStyle = "squares" | "dots" | "rounded" | "classy" | "classy-rounded";
export type QRCornerStyle = "square" | "dot" | "extra-rounded";
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type GradientType = "linear" | "radial" | "none";
export type ExportFormat = "png" | "svg" | "pdf";

export type QRPresetType = "business" | "wifi" | "website" | "contact";

export interface QRGradient {
  type: GradientType;
  colorStart: string;
  colorEnd: string;
  rotation?: number;
}

export interface QRConfig {
  data: string;
  size: number;
  margin: number;
  errorCorrection: ErrorCorrectionLevel;
  style: QRStyle;
  cornerStyle: QRCornerStyle;
  fgColor: string;
  bgColor: string;
  gradient: QRGradient;
  logoFile: File | null;
  logoUrl: string;
  logoSize: number;
  logoMargin: number;
  logoBgEnabled: boolean;
  textEnabled: boolean;
  text: string;
  textFontSize: number;
  textFontFamily: string;
  textColor: string;
}

export interface QRHistoryItem {
  id: number;
  name: string;
  config: string;
  previewDataUrl: string;
  createdAt: string;
}

export const DEFAULT_CONFIG: QRConfig = {
  data: "https://gokohostel.com",
  size: 600,
  margin: 20,
  errorCorrection: "M",
  style: "squares",
  cornerStyle: "square",
  fgColor: "#000000",
  bgColor: "#ffffff",
  gradient: { type: "none", colorStart: "#000000", colorEnd: "#4a90d9" },
  logoFile: null,
  logoUrl: "",
  logoSize: 15,
  logoMargin: 5,
  logoBgEnabled: true,
  textEnabled: false,
  text: "Goko Hostel",
  textFontSize: 24,
  textFontFamily: "Inter, sans-serif",
  textColor: "#000000",
};

export const PRESETS: Record<QRPresetType, Partial<QRConfig> & { label: string; description: string }> = {
  business: {
    label: "Business Card",
    description: "vCard format for contact info",
    data: "BEGIN:VCARD\nVERSION:3.0\nFN:Goko Hostel\nTEL:+91-XXXXXXXXXX\nEMAIL:info@gokohostel.com\nURL:https://gokohostel.com\nEND:VCARD",
    style: "classy-rounded",
    fgColor: "#1a1a2e",
  },
  wifi: {
    label: "Wi-Fi Access",
    description: "Connect guests to WiFi instantly",
    data: "WIFI:T:WPA;S:GokoHostel_WiFi;P:YourPassword;;",
    style: "rounded",
    fgColor: "#0f766e",
  },
  website: {
    label: "Website",
    description: "Link to your website",
    data: "https://gokohostel.com",
    style: "squares",
    fgColor: "#000000",
  },
  contact: {
    label: "Contact Card",
    description: "Phone, email, and location",
    data: "BEGIN:VCARD\nVERSION:3.0\nFN:Goko Hostel\nTEL:+91-XXXXXXXXXX\nADR:;;Your Address;City;State;ZIP;India\nEND:VCARD",
    style: "dots",
    fgColor: "#7c3aed",
  },
};

export const FONT_FAMILIES = [
  "Inter, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
];

export const COLOR_PRESETS = [
  "#000000", "#1a1a2e", "#16213e", "#0f3460",
  "#533483", "#7c3aed", "#e94560", "#f97316",
  "#0f766e", "#15803d", "#1d4ed8", "#6366f1",
];
