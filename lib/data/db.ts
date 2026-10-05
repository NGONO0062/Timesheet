import "server-only";
// Couche d'accès aux données (PROMPT.md §7). C'est le seul endroit où Prisma est
// importé (règle ESLint no-restricted-imports). Chaque fonction métier reçoit un
// contexte qui porte divisionId et le rôle : aucune donnée ne traverse d'une
// division à l'autre.
import { PrismaClient } from "@prisma/client";
import type { Permission, Role } from "@/lib/permissions";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Contexte exigé par chaque accès aux données d'une division. */
export type DivisionScope = {
  divisionId: string;
  userId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
};

export class AccessDenied extends Error {
  constructor(reason: string) {
    super(`Accès refusé : ${reason}`);
    this.name = "AccessDenied";
  }
}

export function assertScope(scope: DivisionScope): void {
  if (!scope.divisionId) throw new AccessDenied("divisionId manquant");
}

export function assertPermission(scope: DivisionScope, permission: Permission): void {
  assertScope(scope);
  if (!scope.permissions.has(permission)) throw new AccessDenied(`permission ${permission} absente`);
}
