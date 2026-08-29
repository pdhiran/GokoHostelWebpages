import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-static";

export const metadata = buildMetadata({
  title: "Order food",
  description: "Order meals at Goko Hostel — identify with your check-in phone and track your kitchen ticket.",
  path: "/food-order",
});

export default function FoodOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
