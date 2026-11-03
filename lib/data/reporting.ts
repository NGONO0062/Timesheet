import "server-only";
// Reporting (PROMPT.md §9.5). Population : les rattachés directs d'un manager ;
// toute la division (personnes qui saisissent leurs temps) pour owner et admin.
import type { Prisma } from "@prisma/client";
import { effectivePermissions, type DivisionRole, type Permission } from "@/lib/permissions";
import { zonedDay } from "@/lib/format";
import type { IsoWeek } from "@/lib/iso-week";
import type { PhaseProject } from "@/lib/reporting/phases";
import type { ReportEntry, ReportPerson, SheetState } from "@/lib/reporting/report";
import { sum } from "@/lib/timesheet/rules";
import { assertPermission, prisma, type DivisionScope } from "./db";
import { getEntrySettings, weekFrame } from "./timesheets";

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Personnes du périmètre de reporting, avec leur équipe. */
export async function listReportPeople(scope: DivisionScope): Promise<ReportPerson[]> {
  assertPermission(scope, "VIEW_REPORTING");
  const whole = scope.role === "OWNER" || scope.role === "DIVISION_ADMIN";
  const [users, overrides] = await Promise.all([
    prisma.user.findMany({
      where: { divisionId: scope.divisionId, active: true, role: { not: "PLATFORM_ADMIN" }, ...(whole ? {} : { managerId: scope.userId }) },
      select: { id: true, firstName: true, lastName: true, role: true, team: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.rolePermission.findMany({ where: { divisionId: scope.divisionId } }),
  ]);
  const matrix = overrides.map((o) => ({ role: o.role as DivisionRole, permission: o.permission as Permission, granted: o.granted }));
  // Seules les personnes qui saisissent leurs temps comptent dans la capacité.
  return users
    .filter((u) => effectivePermissions(u.role, matrix).has("ENTER_TIME"))
    .map((u) => ({ id: u.id, name: fullName(u), team: u.team?.name ?? null }));
}

/** Heures, états des fiches et capacité hebdomadaire d'un groupe de personnes sur des semaines. */
export async function getReportData(scope: DivisionScope, people: ReportPerson[], weeks: IsoWeek[]) {
  assertPermission(scope, "VIEW_REPORTING");
  const personIds = people.map((p) => p.id);
  const weekFilter: Prisma.TimesheetWhereInput = { OR: weeks.map((w) => ({ isoYear: w.year, isoWeek: w.week })) };
  const [rows, sheets, settings] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { line: { timesheet: { divisionId: scope.divisionId, userId: { in: personIds }, ...weekFilter } } },
      select: {
        date: true,
        hours: true,
        line: {
          select: {
            project: { select: { id: true, code: true, name: true, kind: true, _count: { select: { members: true } } } },
            activity: { select: { name: true } },
            timesheet: { select: { userId: true, isoYear: true, isoWeek: true } },
          },
        },
      },
    }),
    prisma.timesheet.findMany({
      where: { divisionId: scope.divisionId, userId: { in: personIds }, ...weekFilter },
      select: { userId: true, isoYear: true, isoWeek: true, status: true },
    }),
    getEntrySettings(scope),
  ]);
  const entries: ReportEntry[] = rows.map((r) => ({
    week: { year: r.line.timesheet.isoYear, week: r.line.timesheet.isoWeek },
    date: r.date,
    personId: r.line.timesheet.userId,
    projectId: r.line.project.id,
    projectCode: r.line.project.code,
    projectName: r.line.project.name,
    activityName: r.line.activity.name,
    hours: Number(r.hours),
  }));
  const members = new Map(rows.map((r) => [r.line.project.id, r.line.project._count.members]));
  const frames = weeks.map((w) => weekFrame(w, settings));
  const states: SheetState[] = people.flatMap((p) =>
    weeks.map((w, i) => {
      const s = sheets.find((x) => x.userId === p.id && x.isoYear === w.year && x.isoWeek === w.week);
      return { personId: p.id, week: w, stored: s?.status ?? null, deadline: frames[i]!.deadline };
    }),
  );
  return { entries, states, members, weekCapacity: frames.map((f) => sum(f.expected)), phaseProjects: await phaseProjectsOf(scope, rows.map((r) => r.line.project)) };
}

/**
 * Projets DMAIC parmi ceux qui ont des jours saisis, avec leurs entrées dans chaque
 * phase, au jour de la division (jours par phase, PROMPT.md §9.5).
 */
async function phaseProjectsOf(scope: DivisionScope, projects: Array<{ id: string; code: string; name: string; kind: "STANDARD" | "DMAIC" }>): Promise<PhaseProject[]> {
  const dmaic = new Map(projects.filter((p) => p.kind === "DMAIC").map((p) => [p.id, p]));
  if (dmaic.size === 0) return [];
  const changes = await prisma.projectPhaseChange.findMany({
    where: { divisionId: scope.divisionId, projectId: { in: [...dmaic.keys()] } },
    orderBy: [{ at: "asc" }, { id: "asc" }],
    select: { projectId: true, phase: true, at: true },
  });
  return [...dmaic.values()].map((p) => ({
    projectId: p.id,
    code: p.code,
    name: p.name,
    changes: changes.filter((c) => c.projectId === p.id).map((c) => ({ phase: c.phase, day: zonedDay(c.at) })),
  }));
}
