import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Ma fiche de présence" };

// Fiche de présence RH : stagiaires seulement (PROMPT.md §20).
export default async function Page() {
  const viewer = await requirePermission("ENTER_TIME");
  if (!viewer.isIntern) notFound();
  return <UpcomingScreen title="Ma fiche de présence" milestone={5} home={homeFor(viewer)} />;
}
