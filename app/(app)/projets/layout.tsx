import type { ReactNode } from "react";
import { requirePermission } from "@/lib/data/viewer";

// Sans la permission, l'écran n'existe pas (404). Contrôle fait ici, avant l'état de
// chargement : sinon la page part en flux avec un statut 200 (les projets).
export default async function Layout({ children }: { children: ReactNode }) {
  await requirePermission("MANAGE_PROJECTS");
  return children;
}
