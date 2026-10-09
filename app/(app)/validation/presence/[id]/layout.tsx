import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSupervisedSheet } from "@/lib/data/attendance";
import { requirePermission, scopeOf } from "@/lib/data/viewer";

// Fiche hors de la portée du superviseur, pas encore signée par le stagiaire ou
// inexistante : vrai 404, vérifié avant l'état de chargement.
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("VALIDATE_TEAM");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id) || !(await getSupervisedSheet(scopeOf(viewer), id))) notFound();
  return children;
}
