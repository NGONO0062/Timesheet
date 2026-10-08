import "server-only";
// Journal d'audit, en ajout seul : cette couche n'expose aucune modification ni
// suppression, et un déclencheur PostgreSQL les refuse (migration journal_audit_ajout_seul).
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PROJECT_STATUS_CHANGED"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_UNARCHIVED"
  | "TIMESHEET_SUBMITTED"
  | "TIMESHEET_VALIDATED"
  | "TIMESHEET_REJECTED"
  | "VALIDATION_REMINDER_SENT"
  | "FILL_REMINDER_SENT";

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
 * Avec `ip`, seulement ceux venus de ce poste.
 */
export async function countRecentLoginFailures(email: string, since: Date, ip?: string): Promise<number> {
  return prisma.auditLog.count({
    where: {
      action: "LOGIN_FAILURE",
      objectLabel: email,
      at: { gte: since },
      ...(ip ? { metadata: { path: ["ip"], equals: ip } } : {}),
    },
  });
}
