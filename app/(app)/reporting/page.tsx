import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Reporting" };

export default async function Page() {
  const viewer = await requirePermission("VIEW_REPORTING");
  return <UpcomingScreen title="Reporting" milestone={4} home={homeFor(viewer)} />;
}
