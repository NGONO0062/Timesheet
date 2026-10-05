import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Divisions" };

export default async function Page() {
  const viewer = await requirePlatformAdmin();
  return <UpcomingScreen title="Divisions" milestone={7} home={homeFor(viewer)} />;
}
