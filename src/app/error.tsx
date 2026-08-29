"use client";

import { SiteShell } from "@/components/layout/SiteShell";
import { ErrorFallback } from "@/components/layout/ErrorFallback";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SiteShell>
      <ErrorFallback reset={reset} />
    </SiteShell>
  );
}
