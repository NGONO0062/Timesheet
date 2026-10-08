import "server-only";
// Vue consolidée de la division (PROMPT.md §9.6). Réservée à la permission
// « Voir la vue consolidée » : toute la division, jamais une autre.
import type { Member, PersonWeek, TeamInfo } from "@/lib/division/consolidated";
import { formatDate, formatRange, zonedDay } from "@/lib/format";
import { todayInDivision, type IsoWeek } from "@/lib/iso-week";
import { fillReminderMail, managerReminderMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { wantsNotification } from "@/lib/notifications";
import { effectivePermissions, type DivisionRole, type Permission } from "@/lib/permissions";
import { entryHref } from "@/lib/routes";
import { reminderDue } from "@/lib/timesheet/workdays";
import { appendAudit } from "./audit";
import { assertPermission, prisma, type DivisionScope } from "./db";
import { getEntrySettings, weekFrame, type EntrySettings } from "./timesheets";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export type DivisionFrame = {
  name: string;
  teams: TeamInfo[];
  people: Member[];
  settings: EntrySettings;
  threshold: number;
  reminderDays: number;
};

/**
 * Division, équipes et collaborateurs comptés : les personnes actives qui saisissent
 * leurs temps, sauf les managers d'équipe (planche 11 : « Parcours, Samuel Etoga · 6 pers. »).
 */
export async function getDivisionFrame(scope: DivisionScope): Promise<DivisionFrame> {
  assertPermission(scope, "VIEW_DIVISION");
  const [division, teams, users, overrides, settings] = await Promise.all([
    prisma.division.findUniqueOrThrow({ where: { id: scope.divisionId }, select: { name: true, settings: { select: { fillAlertThreshold: true, reminderAfterWorkingDays: true } } } }),
    prisma.team.findMany({
      where: { divisionId: scope.divisionId },
      select: { id: true, name: true, managerId: true, manager: { select: { firstName: true, lastName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { divisionId: scope.divisionId, active: true, role: { not: "PLATFORM_ADMIN" } },
      select: { id: true, firstName: true, lastName: true, role: true, teamId: true, managerId: true, manager: { select: { firstName: true, lastName: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.rolePermission.findMany({ where: { divisionId: scope.divisionId } }),
    getEntrySettings(scope),
  ]);
  const matrix = overrides.map((o) => ({ role: o.role as DivisionRole, permission: o.permission as Permission, granted: o.granted }));
  const managers = new Set(teams.map((t) => t.managerId).filter((id): id is string => id !== null));
  return {
    name: division.name,
    teams: teams.map((t) => ({ id: t.id, name: t.name, managerId: t.managerId, manager: t.manager ? fullName(t.manager) : null })),
    people: users
      .filter((u) => !managers.has(u.id) && effectivePermissions(u.role, matrix).has("ENTER_TIME"))
      .map((u) => ({ id: u.id, name: fullName(u), teamId: u.teamId, managerId: u.managerId, manager: u.manager ? fullName(u.manager) : null })),
    settings,
    threshold: division.settings?.fillAlertThreshold ?? 80,
    reminderDays: division.settings?.reminderAfterWorkingDays ?? 3,
  };
}

/** Heures saisies (brouillons compris) et statut de chaque fiche, par personne et par semaine. */
export async function getWeekStates(scope: DivisionScope, frame: DivisionFrame, weeks: IsoWeek[]): Promise<PersonWeek[]> {
  assertPermission(scope, "VIEW_DIVISION");
  const personIds = frame.people.map((p) => p.id);
  const sheets = await prisma.timesheet.findMany({
    where: { divisionId: scope.divisionId, userId: { in: personIds }, OR: weeks.map((w) => ({ isoYear: w.year, isoWeek: w.week })) },
    select: { userId: true, isoYear: true, isoWeek: true, status: true, lines: { select: { entries: { select: { hours: true } } } } },
  });
  const deadlines = weeks.map((w) => weekFrame(w, frame.settings).deadline);
  return frame.people.flatMap((p) =>
    weeks.map((w, i) => {
      const s = sheets.find((x) => x.userId === p.id && x.isoYear === w.year && x.isoWeek === w.week);
      const hours = s ? s.lines.reduce((a, l) => a + l.entries.reduce((b, e) => b + Number(e.hours), 0), 0) : 0;
      return { personId: p.id, week: w, hours: Math.round(hours * 100) / 100, stored: s?.status ?? null, deadline: deadlines[i]! };
    }),
  );
}

/** Sources des dérives de budget et de validation : projets budgétés, fiches soumises en attente. */
export async function getDriftSources(scope: DivisionScope, frame: DivisionFrame, now: Date) {
  assertPermission(scope, "VIEW_DIVISION");
  const holidays = frame.settings.holidays;
  const [projects, consumed, pending] = await Promise.all([
    prisma.project.findMany({
      where: { divisionId: scope.divisionId, isSystem: false, archivedAt: null, budgetHours: { not: null } },
      select: { id: true, name: true, budgetHours: true, manager: { select: { firstName: true, lastName: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { line: { project: { budgetHours: { not: null } }, timesheet: { divisionId: scope.divisionId, status: { in: ["SUBMITTED", "VALIDATED"] } } } },
      select: { hours: true, line: { select: { projectId: true } } },
    }),
    prisma.timesheet.findMany({
      where: { divisionId: scope.divisionId, status: "SUBMITTED", submittedAt: { not: null }, userId: { in: frame.people.map((p) => p.id) } },
      select: { userId: true, submittedAt: true },
    }),
  ]);
  const used = new Map<string, number>();
  for (const e of consumed) used.set(e.line.projectId, (used.get(e.line.projectId) ?? 0) + Number(e.hours));

  const today = todayInDivision(now);
  const late = pending.flatMap((s) => {
    const person = frame.people.find((p) => p.id === s.userId);
    if (!person?.managerId) return [];
    const team = frame.teams.find((t) => t.managerId === person.managerId) ?? frame.teams.find((t) => t.id === person.teamId);
    const isLate = reminderDue({
      submittedDay: zonedDay(s.submittedAt!),
      today,
      afterDays: frame.reminderDays,
      workingDays: frame.settings.workingDays,
      holidays,
      alreadyReminded: false,
    });
    return [{ managerId: person.managerId, manager: person.manager ?? "", team: team?.name ?? person.manager ?? "", late: isLate }];
  });
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      budget: Number(p.budgetHours),
      consumed: used.get(p.id) ?? 0,
      owner: p.manager ? fullName(p.manager) : null,
    })),
    late,
  };
}

// --- Relances (action « Relancer » des dérives) ---------------------------------

export class DivisionRuleError extends Error {
  constructor(readonly code: "notFound" | "nothingLate" | "mailFailed") {
    super(code);
    this.name = "DivisionRuleError";
  }
}

/** Relance un manager pour les fiches de ses rattachés en attente depuis plus de N jours ouvrés. */
export async function remindManager(scope: DivisionScope, managerId: string, now: Date, actorLabel: string): Promise<{ name: string }> {
  const frame = await getDivisionFrame(scope);
  const manager = await prisma.user.findFirst({
    where: { id: managerId, divisionId: scope.divisionId, active: true },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!manager) throw new DivisionRuleError("notFound");
  const { late } = await getDriftSources(scope, frame, now);
  const count = late.filter((s) => s.managerId === manager.id && s.late).length;
  if (count === 0) throw new DivisionRuleError("nothingLate");
  const team = frame.teams.find((t) => t.managerId === manager.id)?.name ?? fullName(manager);
  const ok = await sendMail(
    managerReminderMail({ to: manager.email, firstName: manager.firstName, team, count, days: frame.reminderDays, url: appUrl("/validation") }),
  );
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "VALIDATION_REMINDER_SENT",
    objectLabel: `Équipe ${team} · ${fullName(manager)}`,
    result: ok ? "SUCCESS" : "FAILURE",
    metadata: { count },
  });
  if (!ok) throw new DivisionRuleError("mailFailed");
  return { name: fullName(manager) };
}

/** Rappelle à un collaborateur de saisir une semaine dont l'échéance est passée. */
export async function remindPerson(scope: DivisionScope, personId: string, week: IsoWeek, now: Date, actorLabel: string): Promise<{ name: string }> {
  assertPermission(scope, "VIEW_DIVISION");
  const person = await prisma.user.findFirst({
    where: { id: personId, divisionId: scope.divisionId, active: true },
    select: { id: true, email: true, firstName: true, lastName: true, notificationPrefs: true },
  });
  if (!person) throw new DivisionRuleError("notFound");
  const settings = await getEntrySettings(scope);
  const frame = weekFrame(week, settings);
  const sheet = await prisma.timesheet.findFirst({ where: { divisionId: scope.divisionId, userId: person.id, isoYear: week.year, isoWeek: week.week }, select: { status: true } });
  if (sheet && sheet.status !== "DRAFT") throw new DivisionRuleError("nothingLate");
  if (frame.deadline.getTime() > now.getTime()) throw new DivisionRuleError("nothingLate");
  // La préférence « rappel de saisie » de l'écran 14 s'applique aussi à cette relance.
  const ok = wantsNotification(person.notificationPrefs, "fillReminder")
    ? await sendMail(
        fillReminderMail({
          to: person.email,
          firstName: person.firstName,
          week: week.week,
          range: formatRange(frame.days[0]!, frame.days.at(-1)!),
          deadline: formatDate(zonedDay(frame.deadline)),
          url: appUrl(entryHref(week)),
        }),
      )
    : true;
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "FILL_REMINDER_SENT",
    objectLabel: `Semaine ${week.week} de ${week.year} · ${fullName(person)}`,
    result: ok ? "SUCCESS" : "FAILURE",
  });
  if (!ok) throw new DivisionRuleError("mailFailed");
  return { name: fullName(person) };
}
