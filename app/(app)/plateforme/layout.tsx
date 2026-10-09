import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/data/viewer";

// Réservé à l'admin plateforme : pour les autres, ces pages n'existent pas (404).
// Contrôle fait ici, avant l'état de chargement : sinon la page part en flux avec un statut 200.
export default async function Layout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return children;
}
