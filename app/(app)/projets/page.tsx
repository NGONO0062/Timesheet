import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Projets" };

export default async function Page() {
  const viewer = await requirePermission("MANAGE_PROJECTS");
  return <UpcomingScreen title="Projets" milestone={4} home={homeFor(viewer)} />;
}
