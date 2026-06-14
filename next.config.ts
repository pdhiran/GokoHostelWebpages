import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const isPi = process.env.GOKO_RUNTIME === "pi";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["better-sqlite3"],
  ...(isPi ? { output: "standalone" } : {}),
  env: {
    BUILD_VERSION: process.env.BUILD_VERSION || "unknown",
  },
};

// OpenNext runs Wrangler + monkey-patches Node's `vm` during dev. Loading it only
// when explicitly enabled avoids rare Webpack runtime errors
// (`__webpack_modules__[moduleId] is not a function`) on plain `next dev`.
// Enable with OPENNEXT_CLOUDFLARE_DEV=1 or NEXT_DEV_WRANGLER_ENV.
const shouldInitOpenNextDev =
  process.env.OPENNEXT_CLOUDFLARE_DEV === "1" ||
  Boolean(process.env.NEXT_DEV_WRANGLER_ENV?.length);

if (process.env.NODE_ENV === "development" && shouldInitOpenNextDev) {
  void import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev()
  );
}

const analyzeBundles = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default analyzeBundles(nextConfig);
