import "server-only";
// Paramètres de l'utilisateur connecté (PROMPT.md §9.11, écran 14). Chaque fonction ne
// lit et n'écrit que la ligne de cet utilisateur : l'admin plateforme, sans division,
// y a accès comme les autres rôles, et aucune donnée d'une autre personne n'en sort.
import type { Prisma } from "@prisma/client";
import { checkNewPassword, isTime } from "@/lib/admin/rules";
import type { NotificationKind } from "@/lib/notifications";
import { wantsNotification } from "@/lib/notifications";
import { hashPassword, verifyPassword } from "@/lib/password";
import { appendAudit } from "./audit";
import { prisma } from "./db";

export type SelfScope = { userId: string };

export const NOTIFICATION_KINDS: NotificationKind[] = ["fillReminder", "validated", "rejected", "signatureReminder"];

export class SettingsRuleError extends Error {
  constructor(public readonly code: "time" | "order" | "currentPassword" | "wrongPassword" | "passwordRules" | "passwordConfirm" | "samePassword" | "notFound") {
    super(code);
  }
}

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

async function me(scope: SelfScope) {
  const user = await prisma.user.findUnique({
    where: { id: scope.userId },
    include: {
      division: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true } },
      internship: true,
    },
  });
  if (!user) throw new SettingsRuleError("notFound");
  return user;
}

/** Tout l'écran 14 : profil, stage, horaires, notifications, préférences. */
export async function getMySettings(scope: SelfScope) {
  const user = await me(scope);
  // « Signaler une erreur » écrit aux administrateurs actifs de la division de l'utilisateur.
  const admins = user.divisionId
    ? await prisma.user.findMany({ where: { divisionId: user.divisionId, role: "DIVISION_ADMIN", active: true }, select: { email: true }, orderBy: { email: "asc" } })
    : [];
  return {
    name: fullName(user),
    email: user.email,
    role: user.role,
    division: user.division?.name ?? null,
    manager: user.manager ? fullName(user.manager) : null,
    internship: user.internship
      ? {
          kind: user.internship.kind,
          direction: user.internship.direction,
          department: user.internship.department,
          service: user.internship.service,
          start: user.internship.startDate,
          end: user.internship.endDate,
        }
      : null,
    adminEmails: admins.map((a) => a.email),
    usualArrival: user.usualArrival,
    usualDeparture: user.usualDeparture,
    notifications: Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, wantsNotification(user.notificationPrefs, k)])) as Record<NotificationKind, boolean>,
    locale: user.locale === "en" ? ("en" as const) : ("fr" as const),
    defaultSignatureMode: user.defaultSignatureMode,
    copyPreviousWeek: user.copyPreviousWeek,
  };
}

/** Horaires habituels, au format hh:mm ; le départ suit l'arrivée. */
export async function saveUsualHours(scope: SelfScope, arrival: string, departure: string) {
  const a = arrival.trim();
  const d = departure.trim();
  if (!isTime(a) || !isTime(d)) throw new SettingsRuleError("time");
  if (d <= a) throw new SettingsRuleError("order");
  await prisma.user.update({ where: { id: scope.userId }, data: { usualArrival: a, usualDeparture: d } });
}

/** Une notification, tout de suite ; renvoie l'ancienne valeur pour « Annuler ». */
export async function setNotification(scope: SelfScope, kind: NotificationKind, enabled: boolean): Promise<boolean> {
  const user = await me(scope);
  const prefs = typeof user.notificationPrefs === "object" && user.notificationPrefs !== null && !Array.isArray(user.notificationPrefs) ? (user.notificationPrefs as Prisma.JsonObject) : {};
  const previous = wantsNotification(prefs, kind);
  await prisma.user.update({ where: { id: scope.userId }, data: { notificationPrefs: { ...prefs, [kind]: enabled } } });
  return previous;
}

export type Preferences = { locale: "fr" | "en"; defaultSignatureMode: "DRAWN" | "PASSWORD"; copyPreviousWeek: boolean };

export async function savePreferences(scope: SelfScope, p: Preferences) {
  await prisma.user.update({ where: { id: scope.userId }, data: { locale: p.locale, defaultSignatureMode: p.defaultSignatureMode, copyPreviousWeek: p.copyPreviousWeek } });
}

/** Changement de mot de passe : l'actuel est vérifié, chaque tentative est journalisée. */
export async function changePassword(scope: SelfScope, current: string, next: string, confirm: string) {
  if (!current) throw new SettingsRuleError("currentPassword");
  const user = await me(scope);
  const label = fullName(user);
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
    await appendAudit({ actorId: user.id, actorLabel: label, divisionId: user.divisionId, action: "PASSWORD_CHANGED", objectLabel: user.email, result: "FAILURE", metadata: { reason: "mot-de-passe-actuel" } });
    throw new SettingsRuleError("wrongPassword");
  }
  const problem = checkNewPassword(next, confirm);
  if (problem) throw new SettingsRuleError(problem.field === "next" ? "passwordRules" : "passwordConfirm");
  if (next === current) throw new SettingsRuleError("samePassword");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await appendAudit({ actorId: user.id, actorLabel: label, divisionId: user.divisionId, action: "PASSWORD_CHANGED", objectLabel: user.email, result: "SUCCESS" });
}
