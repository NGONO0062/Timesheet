import "server-only";
// Validation des fiches (PROMPT.md §9.3). Portée : un manager voit ses rattachés
// directs, un owner toute sa division ; personne ne voit une autre division.
import type { Prisma } from "@prisma/client";
import { formatHours, formatDate, formatRange, zonedDay } from "@/lib/format";
import { todayInDivision, type IsoWeek } from "@/lib/iso-week";
import { rejectedMail, reminderMail, validatedMail } from "@/lib/mail/templates";
import { appUrl, sendMail } from "@/lib/mail/send";
import { wantsNotification } from "@/lib/notifications";
import { entryHref } from "@/lib/routes";
import { sum, type StoredStatus } from "@/lib/timesheet/rules";
import { nextStatus } from "@/lib/timesheet/transitions";
import { reminderDue } from "@/lib/timesheet/workdays";
import type { QueueTab } from "@/lib/validation/queue";
import { appendAudit } from "./audit";
import { AccessDenied, assertPermission, prisma, type DivisionScope } from "./db";
import { getEntrySettings, toEntrySettings, weekFrame } from "./timesheets";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const DECIDED: StoredStatus[] = ["SUBMITTED", "VALIDATED", "REJECTED"];

/** Collaborateurs dont le contexte examine les fiches. */
function reviewable(scope: DivisionScope): Prisma.UserWhereInput {
  assertPermission(scope, "VALIDATE_TEAM");
  const base: Prisma.UserWhereInput = { divisionId: scope.divisionId, id: { not: scope.userId } };
  return scope.role === "OWNER" ? base : { ...base, managerId: scope.userId };
}

/** Personnes du filtre « Personne ». */
export async function listReviewablePeople(scope: DivisionScope) {
  const users = await prisma.user.findMany({
    where: reviewable(scope),
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return users.map((u) => ({ id: u.id, name: fullName(u) }));
}

export type QueueFilters = { personId: string | null; weeks: IsoWeek[] | null };

function sheetWhere(scope: DivisionScope, f: QueueFilters): Prisma.TimesheetWhereInput {
  return {
    divisionId: scope.divisionId,
    status: { in: DECIDED },
    user: f.personId ? { AND: [reviewable(scope), { id: f.personId }] } : reviewable(scope),
    ...(f.weeks ? { OR: f.weeks.map((w) => ({ isoYear: w.year, isoWeek: w.week })) } : {}),
  };
}

export type QueueRow = {
  id: string;
  name: string;
  week: IsoWeek;
  status: StoredStatus;
  hours: number;
  expected: number;
  projects: number;
  submittedAt: Date | null;
  submissionCount: number;
};

/** File de validation : lignes de l'onglet et comptes de chaque onglet, sous les mêmes filtres. */
export async function listQueue(scope: DivisionScope, filters: QueueFilters, tab: QueueTab) {
  const where = sheetWhere(scope, filters);
  const [grouped, sheets, settings] = await Promise.all([
    prisma.timesheet.groupBy({ by: ["status"], where, _count: true }),
    prisma.timesheet.findMany({
      where: tab === "ALL" ? where : { ...where, status: tab },
      select: {
        id: true,
        isoYear: true,
        isoWeek: true,
        status: true,
        submittedAt: true,
        submissionCount: true,
        user: { select: { firstName: true, lastName: true } },
        lines: { select: { projectId: true, entries: { select: { hours: true } } } },
      },
      orderBy: [{ isoYear: "desc" }, { isoWeek: "desc" }, { user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    getEntrySettings(scope),
  ]);
  const count = (s: StoredStatus) => grouped.find((g) => g.status === s)?._count ?? 0;
  const counts = { SUBMITTED: count("SUBMITTED"), VALIDATED: count("VALIDATED"), REJECTED: count("REJECTED"), ALL: 0 };
  counts.ALL = counts.SUBMITTED + counts.VALIDATED + counts.REJECTED;
  const rows: QueueRow[] = sheets.map((s) => {
    const week = { year: s.isoYear, week: s.isoWeek };
    return {
      id: s.id,
      name: fullName(s.user),
      week,
      status: s.status,
      hours: sum(s.lines.flatMap((l) => l.entries.map((e) => Number(e.hours)))),
      expected: sum(weekFrame(week, settings).expected),
      projects: new Set(s.lines.map((l) => l.projectId)).size,
      submittedAt: s.submittedAt,
      submissionCount: s.submissionCount,
    };
  });
  return { rows, counts };
}

/** Fiches en attente, dans l'ordre de la file : « Fiche 1 sur 6 », Précédente, Suivante. */
export async function listPendingIds(scope: DivisionScope): Promise<string[]> {
  const rows = await prisma.timesheet.findMany({
    where: { ...sheetWhere(scope, { personId: null, weeks: null }), status: "SUBMITTED" },
    select: { id: true },
    orderBy: [{ isoYear: "desc" }, { isoWeek: "desc" }, { user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });
  return rows.map((r) => r.id);
}

/** La fiche existe-t-elle dans la portée du validateur (hors brouillon) ? */
export async function reviewExists(scope: DivisionScope, id: string): Promise<boolean> {
  return (await prisma.timesheet.count({ where: { id, ...sheetWhere(scope, { personId: null, weeks: null }) } })) > 0;
}

/** Fiche examinée par le validateur ; null hors de sa portée ou encore en brouillon. */
export async function getReview(scope: DivisionScope, id: string) {
  const sheet = await prisma.timesheet.findFirst({
    where: { id, ...sheetWhere(scope, { personId: null, weeks: null }) },
    include: {
      user: { select: { firstName: true, lastName: true, role: true, internship: { select: { userId: true } } } },
      lines: {
        orderBy: { position: "asc" },
        include: { project: { select: { name: true } }, activity: { select: { name: true } }, entries: true },
      },
      events: { orderBy: { at: "desc" }, include: { actor: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!sheet) return null;
  const week = { year: sheet.isoYear, week: sheet.isoWeek };
  const settings = await getEntrySettings(scope);
  const frame = weekFrame(week, settings);
  const index = new Map(frame.days.map((d, i) => [d.getTime(), i]));
  return {
    id: sheet.id,
    week,
    days: frame.days,
    expected: frame.expected,
    status: sheet.status,
    name: fullName(sheet.user),
    role: sheet.user.role,
    isIntern: Boolean(sheet.user.internship),
    submittedAt: sheet.submittedAt,
    comment: sheet.comment,
    lines: sheet.lines.map((l) => {
      const hours: Array<number | null> = frame.days.map(() => null);
      const flagged = frame.days.map(() => false);
      for (const e of l.entries) {
        const i = index.get(e.date.getTime());
        if (i === undefined) continue;
        hours[i] = Number(e.hours);
        flagged[i] = e.flagged;
      }
      return { id: l.id, project: l.project.name, activity: l.activity.name, hours, flagged };
    }),
    events: sheet.events.map((e) => ({ id: e.id, type: e.type, at: e.at, actor: fullName(e.actor) })),
  };
}

// ---------------------------------------------------------------------------
// Décisions
// ---------------------------------------------------------------------------

export type Decision =
  | { kind: "VALIDATE" }
  | { kind: "REJECT"; reason: string; flags?: Array<{ lineId: string; day: number }> };

export class ValidationRuleError extends Error {
  constructor(public readonly code: "reasonMissing" | "flagsNotAllowed") {
    super(`Règle de validation : ${code}`);
    this.name = "ValidationRuleError";
  }
}

/**
 * Valide ou rejette des fiches en attente. Une fiche déjà traitée entre-temps est
 * ignorée et comptée à part. Chaque décision crée un TimesheetEvent et une ligne
 * d'AuditLog, puis prévient le collaborateur par e-mail selon ses préférences.
 */
export async function decide(scope: DivisionScope, ids: string[], decision: Decision, now: Date, actorLabel: string) {
  assertPermission(scope, "VALIDATE_TEAM");
  const reason = decision.kind === "REJECT" ? decision.reason.trim() : "";
  if (decision.kind === "REJECT" && !reason) throw new ValidationRuleError("reasonMissing");
  if (decision.kind === "REJECT" && decision.flags?.length && ids.length !== 1) throw new ValidationRuleError("flagsNotAllowed");

  const settings = await getEntrySettings(scope);
  const action = decision.kind === "VALIDATE" ? "VALIDATE" : "REJECT";
  const done: string[] = [];

  for (const id of [...new Set(ids)]) {
    const sheet = await prisma.timesheet.findFirst({
      where: { id, status: "SUBMITTED", ...sheetWhere(scope, { personId: null, weeks: null }) },
      include: { user: { select: { email: true, firstName: true, lastName: true, notificationPrefs: true } }, lines: { include: { entries: true } } },
    });
    const next = sheet ? nextStatus(sheet.status, action) : null;
    if (!sheet || !next) continue;
    const week = { year: sheet.isoYear, week: sheet.isoWeek };
    const frame = weekFrame(week, settings);

    const changed = await prisma.$transaction(async (tx) => {
      // Garde : une seule décision par soumission, même si deux validateurs cliquent ensemble.
      const { count } = await tx.timesheet.updateMany({
        where: { id: sheet.id, status: "SUBMITTED" },
        data: { status: next, decidedById: scope.userId, decidedAt: now, rejectionReason: decision.kind === "REJECT" ? reason : null },
      });
      if (count === 0) return false;
      if (decision.kind === "REJECT") {
        for (const flag of decision.flags ?? []) {
          const line = sheet.lines.find((l) => l.id === flag.lineId);
          const date = frame.days[flag.day];
          if (!line || !date) throw new AccessDenied("cellule hors de la fiche");
          await tx.timeEntry.upsert({
            where: { lineId_date: { lineId: line.id, date } },
            update: { flagged: true },
            create: { lineId: line.id, date, hours: 0, flagged: true },
          });
        }
      }
      await tx.timesheetEvent.create({
        data: { timesheetId: sheet.id, type: next, actorId: scope.userId, at: now, note: decision.kind === "REJECT" ? reason : null },
      });
      return true;
    });
    if (!changed) continue;
    done.push(sheet.id);

    const name = fullName(sheet.user);
    await appendAudit({
      actorId: scope.userId,
      actorLabel,
      divisionId: scope.divisionId,
      action: next === "VALIDATED" ? "TIMESHEET_VALIDATED" : "TIMESHEET_REJECTED",
      objectLabel: `Semaine ${week.week} de ${week.year} · ${name}`,
      result: "SUCCESS",
    });

    const ref = { week: week.week, range: formatRange(frame.days[0]!, frame.days.at(-1)!), url: appUrl(entryHref(week)) };
    if (next === "VALIDATED" && wantsNotification(sheet.user.notificationPrefs, "validated")) {
      const hours = sum(sheet.lines.flatMap((l) => l.entries.map((e) => Number(e.hours))));
      await sendMail(validatedMail({ ...ref, to: sheet.user.email, firstName: sheet.user.firstName, validator: actorLabel, hours: formatHours(hours) }));
    }
    if (next === "REJECTED" && wantsNotification(sheet.user.notificationPrefs, "rejected")) {
      await sendMail(rejectedMail({ ...ref, to: sheet.user.email, firstName: sheet.user.firstName, validator: actorLabel, reason }));
    }
  }
  return { done: done.length, skipped: new Set(ids).size - done.length, ids: done };
}

// ---------------------------------------------------------------------------
// Relances (tâche planifiée, toutes divisions, chacune avec ses propres règles)
// ---------------------------------------------------------------------------

/**
 * Relance le validateur d'une fiche soumise depuis N jours ouvrés sans décision
 * (N réglé par division, 3 par défaut). Validateur : le manager ; s'il est absent
 * (compte désactivé ou inexistant) et que la division délègue au N+2, l'owner.
 * Une relance par soumission.
 */
export async function sendDueReminders(now: Date): Promise<number> {
  const sheets = await prisma.timesheet.findMany({
    where: { status: "SUBMITTED", submittedAt: { not: null } },
    include: {
      user: { select: { firstName: true, lastName: true, manager: { select: { id: true, email: true, firstName: true, active: true, divisionId: true } } } },
      division: { include: { settings: true, holidays: { select: { date: true } } } },
      events: { orderBy: { at: "desc" }, select: { type: true, at: true } },
    },
  });
  let sent = 0;
  for (const sheet of sheets) {
    const settings = sheet.division.settings;
    const lastSubmit = sheet.events.find((e) => e.type === "SUBMITTED")?.at ?? sheet.submittedAt!;
    const alreadyReminded = sheet.events.some((e) => e.type === "REMINDER_SENT" && e.at.getTime() >= lastSubmit.getTime());
    const due = reminderDue({
      submittedDay: zonedDay(sheet.submittedAt!),
      today: todayInDivision(now),
      afterDays: settings?.reminderAfterWorkingDays ?? 3,
      workingDays: settings?.workingDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      holidays: sheet.division.holidays.map((h) => h.date),
      alreadyReminded,
    });
    if (!due) continue;

    const manager = sheet.user.manager;
    let validator = manager && manager.active && manager.divisionId === sheet.divisionId ? manager : null;
    if (!validator && (settings?.delegateToOwner ?? true)) {
      validator = await prisma.user.findFirst({
        where: { divisionId: sheet.divisionId, role: "OWNER", active: true },
        select: { id: true, email: true, firstName: true, active: true, divisionId: true },
      });
    }
    if (!validator) continue;

    const week = { year: sheet.isoYear, week: sheet.isoWeek };
    const frame = weekFrame(week, toEntrySettings(settings, sheet.division.holidays.map((h) => h.date)));
    const name = fullName(sheet.user);
    const ok = await sendMail(
      reminderMail({
        to: validator.email,
        firstName: validator.firstName,
        name,
        week: week.week,
        range: formatRange(frame.days[0]!, frame.days.at(-1)!),
        since: formatDate(zonedDay(sheet.submittedAt!)),
        url: appUrl(`/validation/${sheet.id}`),
      }),
    );
    if (!ok) continue;
    await prisma.timesheetEvent.create({ data: { timesheetId: sheet.id, type: "REMINDER_SENT", actorId: validator.id, at: now } });
    await appendAudit({
      actorLabel: "TimeSheet",
      divisionId: sheet.divisionId,
      action: "VALIDATION_REMINDER_SENT",
      objectLabel: `Semaine ${week.week} de ${week.year} · ${name}`,
      result: "SUCCESS",
    });
    sent++;
  }
  return sent;
}
