// Rôles et permissions (PROMPT.md §7). La matrice par défaut est modifiable
// par division (écran 12) ; la navigation et chaque contrôle serveur lisent les
// permissions effectives, jamais le nom du rôle.

export type Role = "STAFF" | "MANAGER" | "OWNER" | "DIVISION_ADMIN" | "PLATFORM_ADMIN";
export type DivisionRole = Exclude<Role, "PLATFORM_ADMIN">;

export const PERMISSIONS = [
  "ENTER_TIME",
  "VALIDATE_TEAM",
  "MANAGE_PROJECTS",
  "VIEW_REPORTING",
  "VIEW_DIVISION",
  "ADMINISTER_DIVISION",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DIVISION_ROLES: DivisionRole[] = ["STAFF", "MANAGER", "OWNER", "DIVISION_ADMIN"];

/** Matrice par défaut d'une division. */
export const DEFAULT_MATRIX: Record<DivisionRole, readonly Permission[]> = {
  STAFF: ["ENTER_TIME"],
  MANAGER: ["ENTER_TIME", "VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING"],
  OWNER: ["VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING", "VIEW_DIVISION"],
  DIVISION_ADMIN: ["MANAGE_PROJECTS", "VIEW_REPORTING", "VIEW_DIVISION", "ADMINISTER_DIVISION"],
};

/** La dernière permission de l'admin de division ne peut pas être retirée. */
export function isLocked(role: DivisionRole, permission: Permission): boolean {
  return role === "DIVISION_ADMIN" && permission === "ADMINISTER_DIVISION";
}

export type MatrixOverride = { role: DivisionRole; permission: Permission; granted: boolean };

/** Permissions effectives d'un rôle : matrice par défaut, puis réglages de la division. */
export function effectivePermissions(role: Role, overrides: readonly MatrixOverride[] = []): Set<Permission> {
  if (role === "PLATFORM_ADMIN") return new Set();
  const granted = new Set<Permission>(DEFAULT_MATRIX[role]);
  for (const o of overrides) {
    if (o.role !== role || isLocked(o.role, o.permission)) continue;
    if (o.granted) granted.add(o.permission);
    else granted.delete(o.permission);
  }
  return granted;
}

export function can(permissions: ReadonlySet<Permission>, permission: Permission): boolean {
  return permissions.has(permission);
}
