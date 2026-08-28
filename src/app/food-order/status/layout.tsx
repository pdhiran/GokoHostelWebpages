import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Order status",
  description: "Track your Goko Hostel food order.",
  path: "/food-order/status",
});

export default function FoodOrderStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
