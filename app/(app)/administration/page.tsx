import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Administration de la division" };

export default async function Page() {
  const viewer = await requirePermission("ADMINISTER_DIVISION");
  return <UpcomingScreen title="Administration de la division" milestone={6} home={homeFor(viewer)} />;
}
