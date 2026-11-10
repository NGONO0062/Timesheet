// Utilisateur connecté, tel que l'API le renvoie (GET /api/v1/auth/moi).
export type Role = "STAFF" | "MANAGER" | "OWNER" | "DIVISION_ADMIN" | "PLATFORM_ADMIN";

export type Permission = "ENTER_TIME" | "VALIDATE_TEAM" | "MANAGE_PROJECTS" | "VIEW_REPORTING" | "VIEW_DIVISION" | "ADMINISTER_DIVISION";

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
  /** Mode proposé en premier dans la zone de signature (Paramètres). */
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
