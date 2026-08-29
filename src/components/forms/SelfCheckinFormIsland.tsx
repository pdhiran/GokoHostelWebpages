"use client";

import dynamic from "next/dynamic";

export const SelfCheckinFormIsland = dynamic(
  () => import("@/components/forms/SelfCheckinForm").then((m) => m.SelfCheckinForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green-dark border-t-transparent" />
      </div>
    ),
  },
);
