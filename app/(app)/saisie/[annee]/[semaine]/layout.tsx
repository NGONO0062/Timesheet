import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { parseWeek } from "@/lib/routes";

// Semaine inexistante : vrai 404, vérifié avant l'état de chargement (sinon la page part en flux avec 200).
export default async function WeekLayout({ children, params }: { children: ReactNode; params: Promise<{ annee: string; semaine: string }> }) {
  const { annee, semaine } = await params;
  if (!parseWeek(annee, semaine)) notFound();
  return children;
}
