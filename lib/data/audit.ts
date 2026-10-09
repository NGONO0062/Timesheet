import "server-only";
// Journal d'audit, en ajout seul : cette couche n'expose aucune modification ni
// suppression, et un déclencheur PostgreSQL les refuse (migration journal_audit_ajout_seul).
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "@/lib/audit/catalog";
import { now } from "@/lib/clock";
import { prisma } from "./db";

export type { AuditAction } from "@/lib/audit/catalog";

export type AuditEntry = {
  actorId?: string | null;
  actorLabel: string;
  divisionId?: string | null;
  action: AuditAction;
  objectLabel: string;
  result: "SUCCESS" | "FAILURE";
  metadata?: Prisma.InputJsonObject;
};

export async function appendAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      // Horloge de l'application : en démonstration (TIMESHEET_NOW), le journal suit la
      // même date que les fiches. recordedAt (heure réelle, par défaut) sert aux fenêtres
      // de limitation, qui ne doivent jamais revenir en arrière au redémarrage du serveur.
      at: now(),
      actorId: entry.actorId ?? null,
      actorLabel: entry.actorLabel,
      divisionId: entry.divisionId ?? null,
      action: entry.action,
      objectLabel: entry.objectLabel,
      result: entry.result,
      metadata: entry.metadata ?? {},
    },
  });
}

/**
 * Échecs de connexion récents pour une adresse : limitation des tentatives.
 * Avec `ip`, seulement ceux venus de ce poste. `since` est une heure réelle.
 */
export async function countRecentLoginFailures(email: string, since: Date, ip?: string): Promise<number> {
  return prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILURE",
      objectLabel: email,
      recordedAt: { gte: since },
      ...(ip ? { metadata: { path: ["ip"], equals: ip } } : {}),
    },
  });
}
