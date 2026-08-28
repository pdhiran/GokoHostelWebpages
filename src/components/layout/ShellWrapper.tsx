"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookingGateProvider } from "@/components/booking/BookingGateProvider";

const BARE_ROUTES = ["/admin", "/self-checkin", "/food-order", "/kitchen", "/my-bills", "/review"];

export function ShellWrapper({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (isBare) {
    return <main id="main-content">{children}</main>;
  }

  return (
    <BookingGateProvider>
      {header}
      <main id="main-content">{children}</main>
      {footer}
    </BookingGateProvider>
  );
}
