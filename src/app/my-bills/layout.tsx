import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My bills",
  description: "View your Goko Hostel food bills by phone number.",
  path: "/my-bills",
});

export default function MyBillsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
