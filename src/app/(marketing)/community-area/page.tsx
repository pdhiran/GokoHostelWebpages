import { CommunityPageLive } from "@/components/sections/CommunityPageLive";
import { buildMetadata } from "@/lib/seo";
import { resolveCommunityPageData } from "@/lib/siteContent";
import { defaultCommunityCopy } from "@/lib/siteCopy";

/** Seed HTML at build time — D1 reads live on GET /api/site (Workers Free 10ms cannot SSR this page). */
export const dynamic = "force-static";

export const metadata = buildMetadata({
  title: "Community Area",
  description: defaultCommunityCopy.hero.subtitle,
  path: "/community-area",
});

export default function CommunityAreaPage() {
  return <CommunityPageLive initial={resolveCommunityPageData(null)} />;
}
