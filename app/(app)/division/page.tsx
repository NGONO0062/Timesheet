import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Vue division" };

export default async function Page() {
  const viewer = await requirePermission("VIEW_DIVISION");
  return <UpcomingScreen title="Vue division" milestone={4} home={homeFor(viewer)} />;
}
