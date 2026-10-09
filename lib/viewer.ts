// Utilisateur connecté, tel que l'interface le voit. Construit côté serveur par
// la couche de données à chaque requête : un compte désactivé ou une division
// suspendue n'en produit plus, même avec un jeton de session encore valide.
import type { Permission, Role } from "./permissions";

export type Viewer = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  /** null pour l'admin plateforme. */
  divisionId: string | null;
  divisionName: string | null;
  permissions: Permission[];
  /** Stagiaire : a une fiche de présence RH (PROMPT.md §20). */
  isIntern: boolean;
  /** Mode proposé d'abord sur la zone de signature (Paramètres, §9.11). */
  defaultSignatureMode: "DRAWN" | "PASSWORD";
};

const ROLE_LABELS: Record<Role, string> = {
  STAFF: "Staff",
  MANAGER: "Manager",
  OWNER: "Owner",
  DIVISION_ADMIN: "Admin division",
  PLATFORM_ADMIN: "Admin plateforme",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function initials(v: Pick<Viewer, "firstName" | "lastName">): string {
  return `${v.firstName.charAt(0)}${v.lastName.charAt(0)}`.toUpperCase();
}
