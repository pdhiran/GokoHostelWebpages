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
    // Written during build by the build script
    return process.env.BUILD_VERSION || "unknown";
  } catch {
    return "unknown";
  }
}
