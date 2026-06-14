export function isPiRuntime(): boolean {
  return process.env.GOKO_RUNTIME === "pi";
}

export function isOfflineMode(): boolean {
  return isPiRuntime();
}

export function getRuntimeName(): "cloudflare" | "pi" {
  return isPiRuntime() ? "pi" : "cloudflare";
}

export function getBuildVersion(): string {
  try {
    if (process.env.BUILD_VERSION && process.env.BUILD_VERSION !== "unknown") {
      return process.env.BUILD_VERSION;
    }
    if (isPiRuntime()) {
      const fs = require("fs");
      const path = require("path");
      const versionFile = path.join(process.cwd(), ".build-version");
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, "utf-8").trim().substring(0, 7);
      }
      const { execSync } = require("child_process");
      return execSync("git rev-parse --short HEAD", { cwd: process.cwd(), encoding: "utf-8" }).trim();
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
