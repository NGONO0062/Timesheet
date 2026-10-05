import type { Metadata } from "next";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePlatformAdmin } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function Page() {
  const viewer = await requirePlatformAdmin();
  return <UpcomingScreen title="Journal d'audit" milestone={7} home={homeFor(viewer)} />;
}
