import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { followUpExists } from "@/lib/data/dmaic";
import { requirePermission, scopeOf } from "@/lib/data/viewer";

// Projet hors de portée (ni géré ni sponsorisé), d'une autre division ou inexistant :
// vrai 404, vérifié avant l'état de chargement (sinon la page part en flux avec 200).
export default async function FollowUpLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("MANAGE_PROJECTS");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id) || !(await followUpExists(scopeOf(viewer), id))) notFound();
  return children;
}
