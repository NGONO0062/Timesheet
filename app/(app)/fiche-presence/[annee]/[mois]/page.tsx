import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UpcomingScreen } from "@/components/ts/UpcomingScreen";
import { requirePermission } from "@/lib/data/viewer";
import { homeFor } from "@/lib/navigation";

export const metadata: Metadata = { title: "Ma fiche de présence" };

// Écran 6 (jalon 5). La route existe déjà : le tableau de bord y mène par « Signer ma fiche ».
export default async function Page({ params }: { params: Promise<{ annee: string; mois: string }> }) {
  const viewer = await requirePermission("ENTER_TIME");
  const { annee, mois } = await params;
  if (!viewer.isIntern || !/^\d{4}$/.test(annee) || !/^(1[0-2]|[1-9])$/.test(mois)) notFound();
  return <UpcomingScreen title="Ma fiche de présence" milestone={5} home={homeFor(viewer)} />;
}
