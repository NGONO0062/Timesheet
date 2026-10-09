import "server-only";
import { effectivePermissions, type DivisionRole, type Permission } from "@/lib/permissions";
import type { Viewer } from "@/lib/viewer";
import { assertScope, prisma, type DivisionScope } from "./db";

/**
 * Compte cherché à la connexion, par adresse. Seule lecture faite avant de
 * connaître la division : elle ne renvoie que de quoi vérifier le mot de passe.
 */
export async function findLoginAccount(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      active: true,
      divisionId: true,
      division: { select: { status: true } },
    },
  });
}

/** Un compte peut se connecter s'il est actif et si sa division n'est pas suspendue. */
export function canSignIn(account: { active: boolean; division: { status: string } | null }): boolean {
  return account.active && account.division?.status !== "SUSPENDED";
}

/** Reconstruit l'utilisateur connecté depuis la base, à chaque requête. */
export async function loadViewer(userId: string): Promise<Viewer | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      division: { include: { permissions: true } },
      internship: { select: { userId: true } },
    },
  });
  if (!user || !canSignIn(user)) return null;
  if (user.role !== "PLATFORM_ADMIN" && !user.divisionId) return null;

  const overrides = (user.division?.permissions ?? []).map((p) => ({
    role: p.role as DivisionRole,
    permission: p.permission as Permission,
    granted: p.granted,
  }));
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    divisionId: user.divisionId,
    divisionName: user.division?.name ?? null,
    permissions: [...effectivePermissions(user.role, overrides)],
    isIntern: Boolean(user.internship),
    defaultSignatureMode: user.defaultSignatureMode,
  };
}

/** Utilisateurs de la division du contexte, jamais d'une autre. */
export async function listDivisionUsers(scope: DivisionScope) {
  assertScope(scope);
  return prisma.user.findMany({
    where: { divisionId: scope.divisionId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
