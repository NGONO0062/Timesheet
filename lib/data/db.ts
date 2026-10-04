import "server-only";
// Couche d'accès aux données (PROMPT.md §7). C'est le seul endroit où Prisma est
// importé (règle ESLint no-restricted-imports). Chaque fonction métier reçoit un
// contexte qui porte divisionId et le rôle : aucune donnée ne traverse d'une
// division à l'autre. Les accès métier arrivent au jalon 1.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Role = "STAFF" | "MANAGER" | "OWNER" | "DIVISION_ADMIN" | "PLATFORM_ADMIN";

/** Contexte exigé par chaque accès aux données d'une division. */
export type DivisionScope = {
  divisionId: string;
  userId: string;
  role: Role;
};

export function assertScope(scope: DivisionScope): void {
  if (!scope.divisionId) throw new Error("Accès refusé : divisionId manquant.");
}
