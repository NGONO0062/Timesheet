import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Saisie hebdomadaire" };

export default async function Page() {
  const viewer = await requirePermission("ENTER_TIME");
  return <UpcomingScreen title="Saisie hebdomadaire" milestone={2} home={homeFor(viewer)} />;
}
