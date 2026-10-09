import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/data/viewer";

// Fiche de présence RH : stagiaires seulement (PROMPT.md §20). Contrôle fait ici, avant
// l'état de chargement, pour garder un vrai 404.
export default async function Layout({ children }: { children: ReactNode }) {
  const viewer = await requirePermission("ENTER_TIME");
  if (!viewer.isIntern) notFound();
  return children;
}
