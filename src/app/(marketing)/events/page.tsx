import { EventsPageLive } from "@/components/sections/EventsPageLive";
import { buildMetadata } from "@/lib/seo";
import { resolveEventsPageData } from "@/lib/siteContent";
import { defaultEventsCopy } from "@/lib/siteCopy";

/** Seed HTML at build time — D1 reads live on GET /api/site (Workers Free 10ms cannot SSR this page). */
export const dynamic = "force-static";

export const metadata = buildMetadata({
  title: "Events",
  description: defaultEventsCopy.hero.subtitle,
  path: "/events",
});

export default function EventsPage() {
  return <EventsPageLive initial={resolveEventsPageData(null)} />;
}
