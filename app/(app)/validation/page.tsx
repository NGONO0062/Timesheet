import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Fiches à valider" };

export default async function Page() {
  const viewer = await requirePermission("VALIDATE_TEAM");
  return <UpcomingScreen title="Fiches à valider" milestone={3} home={homeFor(viewer)} />;
}
