"use client";

import { ErrorFallback } from "@/components/layout/ErrorFallback";

export default function MarketingErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback reset={reset} />;
}
