import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Leave a review",
  description: "Share your stay at Goko Hostel.",
  path: "/review",
});

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
