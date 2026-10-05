import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requireViewer } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Page() {
  const viewer = await requireViewer();
  return <UpcomingScreen title="Paramètres" milestone={6} home={homeFor(viewer)} />;
}
