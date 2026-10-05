import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { reviewExists } from "@/lib/data/validation";
import { requirePermission, scopeOf } from "@/lib/data/viewer";

// Fiche hors de la portée du validateur, encore en brouillon ou inexistante : vrai 404,
// vérifié avant l'état de chargement (sinon la page part en flux avec 200).
export default async function ReviewLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id) || !(await reviewExists(scopeOf(viewer), id))) notFound();
  return children;
}
