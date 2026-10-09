import "server-only";
// Fiches de temps (PROMPT.md §9.1 et §9.2). Chaque fonction reçoit le contexte de
// division et ne lit que les fiches de l'utilisateur connecté, dans sa division.
import type { DivisionSettings, Prisma } from "@prisma/client";
import { canAddLine } from "@/lib/projects/rules";
import { PROJECT_STATUS_ORDER, type ProjectStatus } from "@/lib/status";
import { addDays, compareWeeks, isoWeekOf, mondayOf, shiftWeek, todayInDivision, workingDaysOf, type IsoWeek, type Weekday } from "@/lib/iso-week";
import { lineKey, planDraft, type DraftError, type DraftLineInput, type ExistingLine } from "@/lib/timesheet/draft";
import { dayTotals, expectedPerDay, submitCheck, weekDeadline, type StoredStatus } from "@/lib/timesheet/rules";
import { isEditable, nextStatus } from "@/lib/timesheet/transitions";
import { appendAudit } from "./audit";
import { assertPermission, assertScope, prisma, type DivisionScope } from "./db";

export type EntrySettings = {
  hoursPerDay: number;
  step: number;
  workingDays: Weekday[];
  deadlineDay: Weekday;
  deadlineTime: string;
  allowFutureWeeks: boolean;
  lockAfterValidation: boolean;
  holidays: Date[];
};

/** Règles de saisie de la division : jamais écrites en dur (PROMPT.md §9.2). Lisibles par tout membre de la division. */
export async function getEntrySettings(scope: DivisionScope): Promise<EntrySettings> {
  assertScope(scope);
  const [s, holidays] = await Promise.all([
    prisma.divisionSettings.findUnique({ where: { divisionId: scope.divisionId } }),
    prisma.holiday.findMany({ where: { divisionId: scope.divisionId }, select: { date: true } }),
  ]);
  return toEntrySettings(s, holidays.map((h) => h.date));
}

/** Réglages stockés vers règles de saisie ; valeurs par défaut du §8 si la division n'a rien réglé. */
export function toEntrySettings(s: DivisionSettings | null, holidays: Date[]): EntrySettings {
  return {
    hoursPerDay: s ? Number(s.hoursPerDay) : 8,
    step: s ? Number(s.step) : 0.5,
    workingDays: s?.workingDays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    deadlineDay: s?.deadlineDay ?? "FRIDAY",
    deadlineTime: s?.deadlineTime ?? "18:00",
    allowFutureWeeks: s?.allowFutureWeeks ?? false,
    lockAfterValidation: s?.lockAfterValidation ?? true,
    holidays,
  };
}

/** Jours ouvrés, heures attendues et échéance d'une semaine. */
export function weekFrame(week: IsoWeek, settings: EntrySettings) {
  const days = workingDaysOf(week, settings.workingDays);
  return {
    days,
    expected: expectedPerDay(days, settings.hoursPerDay, settings.holidays),
    deadline: weekDeadline(week, settings),
    start: mondayOf(week),
    end: addDays(mondayOf(week), 6),
  };
}

/** Semaine en cours dans le fuseau de la division. */
export function currentWeek(now: Date): IsoWeek {
  return isoWeekOf(todayInDivision(now));
}

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Le validateur de l'utilisateur : son manager (N+1). */
export async function getValidator(scope: DivisionScope) {
  const me = await prisma.user.findFirst({
    where: { id: scope.userId, divisionId: scope.divisionId },
    select: { manager: { select: { firstName: true, lastName: true, role: true, divisionId: true } } },
  });
  const m = me?.manager;
  if (!m || m.divisionId !== scope.divisionId) return null;
  return { name: fullName(m), role: m.role };
}

/** Profil affiché en tête du tableau de bord. */
export async function getProfile(scope: DivisionScope) {
  const me = await prisma.user.findFirst({
    where: { id: scope.userId, divisionId: scope.divisionId },
    select: {
      firstName: true,
      createdAt: true,
      copyPreviousWeek: true,
      internship: { select: { startDate: true } },
      division: { select: { name: true } },
    },
  });
  if (!me) throw new Error("Utilisateur introuvable dans sa division");
  return {
    firstName: me.firstName,
    divisionName: me.division?.name ?? "",
    isIntern: Boolean(me.internship),
    /** Préférence (Paramètres) : reprendre les lignes de la semaine précédente à l'ouverture d'une semaine vide. */
    copyPreviousWeek: me.copyPreviousWeek,
    /** Première semaine due : début de stage, sinon création du compte. */
    since: me.internship?.startDate ?? me.createdAt,
  };
}

const sheetInclude = {
  decidedBy: { select: { firstName: true, lastName: true } },
  lines: {
    orderBy: { position: "asc" },
    include: {
      project: { select: { id: true, name: true, code: true, status: true } },
      activity: { select: { id: true, name: true } },
      entries: true,
    },
  },
  events: { orderBy: { at: "desc" }, include: { actor: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.TimesheetInclude;

type SheetRow = Prisma.TimesheetGetPayload<{ include: typeof sheetInclude }>;

async function findSheet(scope: DivisionScope, week: IsoWeek, db: Prisma.TransactionClient = prisma): Promise<SheetRow | null> {
  return db.timesheet.findFirst({
    where: { divisionId: scope.divisionId, userId: scope.userId, isoYear: week.year, isoWeek: week.week },
    include: sheetInclude,
  });
}

export type SheetLine = {
  projectId: string;
  activityId: string;
  project: string;
  activity: string;
  projectStatus: ProjectStatus;
  /** null : cellule laissée vide. */
  hours: Array<number | null>;
  flagged: boolean[];
};

function linesOf(sheet: SheetRow | null, days: Date[]): SheetLine[] {
  if (!sheet) return [];
  const index = new Map(days.map((d, i) => [d.getTime(), i]));
  return sheet.lines.map((l) => {
    const hours: Array<number | null> = days.map(() => null);
    const flagged = days.map(() => false);
    for (const e of l.entries) {
      const i = index.get(e.date.getTime());
      if (i === undefined) continue;
      hours[i] = Number(e.hours);
      flagged[i] = e.flagged;
    }
    return {
      projectId: l.projectId,
      activityId: l.activityId,
      project: l.project.name,
      activity: l.activity.name,
      projectStatus: l.project.status,
      hours,
      flagged,
    };
  });
}

export type EligibleLine = { projectId: string; activityId: string; project: string; activity: string; code: string };

/**
 * Lignes qu'on peut ajouter : projets dont on est membre, « En cours », qui
 * couvrent la semaine, plus l'activité système « Absence » (PROMPT.md §20).
 */
export async function listEligibleLines(scope: DivisionScope, week: IsoWeek): Promise<EligibleLine[]> {
  assertPermission(scope, "ENTER_TIME");
  const start = mondayOf(week);
  const end = addDays(start, 6);
  const projects = await prisma.project.findMany({
    where: {
      divisionId: scope.divisionId,
      archivedAt: null,
      status: "IN_PROGRESS",
      OR: [{ members: { some: { userId: scope.userId } } }, { isSystem: true }],
    },
    include: { activities: { orderBy: { name: "asc" } } },
    orderBy: [{ isSystem: "asc" }, { code: "asc" }],
  });
  return projects
    .filter((p) => canAddLine({ status: p.status, isMember: true, project: p, weekStart: start, weekEnd: end }))
    .flatMap((p) => p.activities.map((a) => ({ projectId: p.id, activityId: a.id, project: p.name, activity: a.name, code: p.code })));
}

export type WeekSummary = { week: IsoWeek; stored: StoredStatus | null; hours: number };

/** Statut stocké et heures de plusieurs semaines de l'utilisateur. */
export async function listWeekSummaries(scope: DivisionScope, weeks: IsoWeek[]): Promise<WeekSummary[]> {
  assertPermission(scope, "ENTER_TIME");
  if (weeks.length === 0) return [];
  const sheets = await prisma.timesheet.findMany({
    where: { divisionId: scope.divisionId, userId: scope.userId, OR: weeks.map((w) => ({ isoYear: w.year, isoWeek: w.week })) },
    select: { isoYear: true, isoWeek: true, status: true, lines: { select: { entries: { select: { hours: true } } } } },
  });
  return weeks.map((week) => {
    const s = sheets.find((x) => x.isoYear === week.year && x.isoWeek === week.week);
    const hours = s ? s.lines.flatMap((l) => l.entries).reduce((a, e) => a + Number(e.hours), 0) : 0;
    return { week, stored: s?.status ?? null, hours: Math.round(hours * 100) / 100 };
  });
}

/** Fiches rejetées à corriger. */
export async function listRejectedSheets(scope: DivisionScope) {
  assertPermission(scope, "ENTER_TIME");
  const rows = await prisma.timesheet.findMany({
    where: { divisionId: scope.divisionId, userId: scope.userId, status: "REJECTED" },
    select: { isoYear: true, isoWeek: true, decidedBy: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isoYear: "desc" }, { isoWeek: "desc" }],
  });
  return rows.map((r) => ({ week: { year: r.isoYear, week: r.isoWeek }, decidedBy: r.decidedBy ? fullName(r.decidedBy) : "" }));
}

/** Fiches de présence en attente de la signature du stagiaire, avec les heures validées du mois. */
export async function listAttendanceToSign(scope: DivisionScope) {
  assertPermission(scope, "ENTER_TIME");
  const sheets = await prisma.attendanceSheet.findMany({
    where: { divisionId: scope.divisionId, userId: scope.userId, status: "GENERATED" },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  return Promise.all(
    sheets.map(async (s) => {
      const from = new Date(Date.UTC(s.year, s.month - 1, 1));
      const to = new Date(Date.UTC(s.year, s.month, 1));
      const sum = await prisma.timeEntry.aggregate({
        _sum: { hours: true },
        where: {
          date: { gte: from, lt: to },
          line: { timesheet: { divisionId: scope.divisionId, userId: scope.userId, status: "VALIDATED" } },
        },
      });
      return { year: s.year, month: s.month, generatedAt: s.generatedAt, validatedHours: Number(sum._sum.hours ?? 0) };
    }),
  );
}

/** Projets de l'utilisateur, sauf les terminés, avec ses heures de la semaine. */
export async function listMyProjects(scope: DivisionScope, week: IsoWeek) {
  assertPermission(scope, "ENTER_TIME");
  const [projects, sheet] = await Promise.all([
    prisma.project.findMany({
      where: { divisionId: scope.divisionId, archivedAt: null, isSystem: false, status: { not: "DONE" }, members: { some: { userId: scope.userId } } },
      include: { activities: { orderBy: { name: "asc" }, select: { name: true } } },
    }),
    prisma.timesheet.findFirst({
      where: { divisionId: scope.divisionId, userId: scope.userId, isoYear: week.year, isoWeek: week.week },
      select: { lines: { select: { projectId: true, activityId: true, activity: { select: { name: true } }, entries: { select: { hours: true } } } } },
    }),
  ]);
  const hoursOf = (projectId: string) =>
    (sheet?.lines ?? []).filter((l) => l.projectId === projectId).flatMap((l) => l.entries).reduce((a, e) => a + Number(e.hours), 0);
  // Activités dans l'ordre de la saisie, puis les autres.
  const used = (projectId: string) => (sheet?.lines ?? []).filter((l) => l.projectId === projectId).map((l) => l.activity.name);
  // Ordre de la maquette : projets ouverts d'abord, les plus chargés cette semaine en tête.
  const rank = (status: ProjectStatus) => PROJECT_STATUS_ORDER.indexOf(status);
  return projects.map((p) => {
    const first = used(p.id);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      activities: [...first, ...p.activities.map((a) => a.name).filter((n) => !first.includes(n))],
      hours: Math.round(hoursOf(p.id) * 100) / 100,
    };
  }).sort((a, b) => rank(a.status) - rank(b.status) || b.hours - a.hours || a.code.localeCompare(b.code, "fr"));
}

export type WeekSheet = {
  stored: StoredStatus | null;
  comment: string;
  submittedAt: Date | null;
  submissionCount: number;
  decidedAt: Date | null;
  decidedBy: string | null;
  rejectionReason: string | null;
  updatedAt: Date | null;
  lines: SheetLine[];
  events: Array<{ id: string; type: string; at: Date; actor: string; self: boolean }>;
};

/** Fiche de l'utilisateur pour une semaine (vide si rien n'est encore saisi). */
export async function getWeekSheet(scope: DivisionScope, week: IsoWeek, days: Date[]): Promise<WeekSheet> {
  assertPermission(scope, "ENTER_TIME");
  const sheet = await findSheet(scope, week);
  return {
    stored: sheet?.status ?? null,
    comment: sheet?.comment ?? "",
    submittedAt: sheet?.submittedAt ?? null,
    submissionCount: sheet?.submissionCount ?? 0,
    decidedAt: sheet?.decidedAt ?? null,
    decidedBy: sheet?.decidedBy ? fullName(sheet.decidedBy) : null,
    rejectionReason: sheet?.rejectionReason ?? null,
    updatedAt: sheet?.updatedAt ?? null,
    lines: linesOf(sheet, days),
    events: (sheet?.events ?? []).map((e) => ({ id: e.id, type: e.type, at: e.at, actor: fullName(e.actor), self: e.actorId === scope.userId })),
  };
}

/** Lignes de la semaine précédente qu'on peut reprendre (sans les heures). */
export async function listPreviousLines(scope: DivisionScope, week: IsoWeek, eligible: EligibleLine[]): Promise<EligibleLine[]> {
  const prev = shiftWeek(week, -1);
  const sheet = await prisma.timesheet.findFirst({
    where: { divisionId: scope.divisionId, userId: scope.userId, isoYear: prev.year, isoWeek: prev.week },
    select: { lines: { orderBy: { position: "asc" }, select: { projectId: true, activityId: true } } },
  });
  const allowed = new Map(eligible.map((e) => [lineKey(e), e]));
  return (sheet?.lines ?? []).map((l) => allowed.get(lineKey(l))).filter((e): e is EligibleLine => Boolean(e));
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

export type TimesheetError = DraftError | "notEditable" | "futureWeek" | "incomplete" | "noValidator";

export class TimesheetRuleError extends Error {
  constructor(public readonly code: TimesheetError) {
    super(`Règle de saisie : ${code}`);
    this.name = "TimesheetRuleError";
  }
}

export type DraftInput = { week: IsoWeek; comment: string; lines: DraftLineInput[] };

/**
 * Enregistre le brouillon. Le serveur revérifie tout : semaine permise, fiche
 * modifiable, lignes autorisées, pas de saisie, lignes verrouillées intactes.
 */
export async function saveDraft(scope: DivisionScope, input: DraftInput, now: Date): Promise<{ savedAt: Date }> {
  assertPermission(scope, "ENTER_TIME");
  const settings = await getEntrySettings(scope);
  if (!settings.allowFutureWeeks && compareWeeks(input.week, currentWeek(now)) > 0) throw new TimesheetRuleError("futureWeek");
  const frame = weekFrame(input.week, settings);
  const eligible = new Set((await listEligibleLines(scope, input.week)).map(lineKey));

  await prisma.$transaction(async (tx) => {
    const sheet = await findSheet(scope, input.week, tx);
    if (sheet && !isEditable(sheet.status, settings.lockAfterValidation)) throw new TimesheetRuleError("notEditable");
    const existing: ExistingLine[] = linesOf(sheet, frame.days).map((l) => ({ ...l, open: l.projectStatus === "IN_PROGRESS" }));
    const plan = planDraft({ lines: input.lines, existing, eligible, step: settings.step, dayCount: frame.days.length });
    if (!plan.ok) throw new TimesheetRuleError(plan.error);

    const comment = input.comment.trim() || null;
    // Rien saisi et pas encore de fiche : on ne crée rien.
    if (!sheet && plan.lines.length === 0 && !comment) return;

    let id: string;
    if (sheet) {
      id = (await tx.timesheet.update({ where: { id: sheet.id }, data: { comment, updatedAt: now } })).id;
    } else {
      id = (await tx.timesheet.create({ data: { divisionId: scope.divisionId, userId: scope.userId, isoYear: input.week.year, isoWeek: input.week.week, comment, updatedAt: now } })).id;
      // « Brouillon créé » dans l'historique de la fiche (écran 08).
      await tx.timesheetEvent.create({ data: { timesheetId: id, type: "CREATED", actorId: scope.userId, at: now } });
    }

    await tx.timesheetLine.deleteMany({ where: { timesheetId: id } });
    for (const line of plan.lines) {
      await tx.timesheetLine.create({
        data: {
          timesheetId: id,
          projectId: line.projectId,
          activityId: line.activityId,
          position: line.position,
          entries: { create: line.entries.map((e) => ({ date: frame.days[e.day]!, hours: e.hours, flagged: e.flagged })) },
        },
      });
    }
  });
  return { savedAt: now };
}

/**
 * Soumet la semaine : enregistre d'abord la saisie reçue, puis vérifie que chaque
 * jour ouvré totalise les heures attendues. Crée un TimesheetEvent et une ligne
 * d'AuditLog (PROMPT.md §9.3).
 */
export async function submitWeek(scope: DivisionScope, input: DraftInput, now: Date, actorLabel: string): Promise<void> {
  assertPermission(scope, "ENTER_TIME");
  if (!(await getValidator(scope))) throw new TimesheetRuleError("noValidator");
  await saveDraft(scope, input, now);
  const settings = await getEntrySettings(scope);
  const frame = weekFrame(input.week, settings);

  await prisma.$transaction(async (tx) => {
    const sheet = await findSheet(scope, input.week, tx);
    if (!sheet) throw new TimesheetRuleError("incomplete");
    const next = nextStatus(sheet.status, "SUBMIT");
    if (!next) throw new TimesheetRuleError("notEditable");
    const totals = dayTotals(linesOf(sheet, frame.days).map((l) => l.hours.map((h) => h ?? 0)), frame.days.length);
    if (!submitCheck(frame.days, totals, frame.expected).canSubmit) throw new TimesheetRuleError("incomplete");

    await tx.timesheet.update({
      where: { id: sheet.id },
      data: { status: next, submittedAt: now, submissionCount: { increment: 1 }, decidedAt: null, decidedById: null, rejectionReason: null, updatedAt: now },
    });
    // Les cellules signalées ont été traitées par cette nouvelle soumission.
    await tx.timeEntry.updateMany({ where: { line: { timesheetId: sheet.id }, flagged: true }, data: { flagged: false } });
    await tx.timesheetEvent.create({ data: { timesheetId: sheet.id, type: "SUBMITTED", actorId: scope.userId, at: now, note: sheet.comment } });
  });

  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: "TIMESHEET_SUBMITTED",
    objectLabel: `Semaine ${input.week.week} de ${input.week.year} · ${actorLabel}`,
    result: "SUCCESS",
  });
}
