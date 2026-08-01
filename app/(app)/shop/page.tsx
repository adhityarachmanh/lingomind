import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ShopView from "@/components/ShopView";

export default async function ShopPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ShopView />;
}
