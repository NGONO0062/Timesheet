import "server-only";
// Projets (PROMPT.md §9.4). Portée : un manager voit les projets dont il est
// responsable ou qui comptent un de ses rattachés ; owner et admin de division
// voient tous les projets de la division. Jamais ceux d'une autre division.
import type { Prisma } from "@prisma/client";
import { checkProjectInput, nextProjectCode, type ProjectInput } from "@/lib/projects/rules";
import type { ProjectStatus } from "@/lib/status";
import { appendAudit } from "./audit";
import { assertPermission, prisma, type DivisionScope } from "./db";

const CONSUMED: Array<"SUBMITTED" | "VALIDATED"> = ["SUBMITTED", "VALIDATED"];
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const seesWholeDivision = (scope: DivisionScope) => scope.role === "OWNER" || scope.role === "DIVISION_ADMIN";

function projectWhere(scope: DivisionScope): Prisma.ProjectWhereInput {
  assertPermission(scope, "MANAGE_PROJECTS");
  const base: Prisma.ProjectWhereInput = { divisionId: scope.divisionId, isSystem: false };
  if (seesWholeDivision(scope)) return base;
  return { ...base, OR: [{ managerId: scope.userId }, { members: { some: { user: { managerId: scope.userId } } } }] };
}

/** Personnes qu'on peut affecter : l'équipe du manager, ou toute la division pour owner et admin. */
async function assignable(scope: DivisionScope) {
  return prisma.user.findMany({
    where: {
      divisionId: scope.divisionId,
      active: true,
      role: { in: ["STAFF", "MANAGER"] },
      ...(seesWholeDivision(scope) ? {} : { managerId: scope.userId }),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  startDate: Date;
  endDate: Date | null;
  budgetHours: number | null;
  consumed: number;
  archived: boolean;
  memberIds: string[];
  activities: string[];
  manager: string | null;
};

/** Projets de la portée, archivés compris, avec leurs heures consommées (fiches soumises ou validées). */
export async function listProjects(scope: DivisionScope): Promise<{ projects: ProjectRow[]; team: Array<{ id: string; name: string }> }> {
  const [projects, team] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere(scope),
      include: {
        members: { select: { userId: true } },
        activities: { orderBy: { name: "asc" }, select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    }),
    assignable(scope),
  ]);
  const entries = await prisma.timeEntry.findMany({
    where: { line: { projectId: { in: projects.map((p) => p.id) }, timesheet: { divisionId: scope.divisionId, status: { in: CONSUMED } } } },
    select: { hours: true, line: { select: { projectId: true } } },
  });
  const consumed = new Map<string, number>();
  for (const e of entries) consumed.set(e.line.projectId, (consumed.get(e.line.projectId) ?? 0) + Number(e.hours));
  return {
    projects: projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      budgetHours: p.budgetHours === null ? null : Number(p.budgetHours),
      consumed: Math.round((consumed.get(p.id) ?? 0) * 100) / 100,
      archived: p.archivedAt !== null,
      memberIds: p.members.map((m) => m.userId),
      activities: p.activities.map((a) => a.name),
      manager: p.manager ? fullName(p.manager) : null,
    })),
    team: team.map((u) => ({ id: u.id, name: fullName(u) })),
  };
}

export class ProjectRuleError extends Error {
  constructor(
    public readonly code: "invalid" | "notFound" | "members" | "activityInUse",
    public readonly detail: Record<string, string> = {},
  ) {
    super(`Règle de projet : ${code}`);
    this.name = "ProjectRuleError";
  }
}

async function findInScope(scope: DivisionScope, id: string, db: Prisma.TransactionClient = prisma) {
  const project = await db.project.findFirst({ where: { id, ...projectWhere(scope) }, include: { activities: { include: { _count: { select: { lines: true } } } }, members: true } });
  if (!project) throw new ProjectRuleError("notFound");
  return project;
}

/**
 * Changement de statut : immédiat, sans confirmation (PROMPT.md §9.4). Renvoie
 * l'ancien statut, pour « Annuler ». Chaque changement écrit une ligne d'AuditLog.
 */
export async function changeProjectStatus(scope: DivisionScope, id: string, status: ProjectStatus, now: Date, actorLabel: string) {
  const project = await findInScope(scope, id);
  if (project.status !== status) {
    await prisma.project.update({ where: { id: project.id }, data: { status, statusChangedAt: now, statusChangedById: scope.userId } });
    await appendAudit({
      actorId: scope.userId,
      actorLabel,
      divisionId: scope.divisionId,
      action: "PROJECT_STATUS_CHANGED",
      objectLabel: `${project.code} · ${project.name}`,
      result: "SUCCESS",
      metadata: { from: project.status, to: status },
    });
  }
  return { name: project.name, previous: project.status };
}

/** Création ou modification depuis le panneau. Le code est attribué à la création. */
export async function saveProject(scope: DivisionScope, id: string | null, input: ProjectInput, now: Date, actorLabel: string) {
  const checked = checkProjectInput(input);
  if (!checked.ok) throw new ProjectRuleError("invalid", checked.errors as Record<string, string>);
  const v = checked.value;
  const team = new Set((await assignable(scope)).map((u) => u.id));
  if (v.memberIds.some((m) => !team.has(m))) throw new ProjectRuleError("members");

  if (id === null) {
    const division = await prisma.division.findUniqueOrThrow({ where: { id: scope.divisionId }, select: { department: true, slug: true } });
    const prefix = (division.department ?? division.slug.slice(0, 3)).toUpperCase();
    const year = v.startDate.getUTCFullYear();
    const codes = await prisma.project.findMany({ where: { divisionId: scope.divisionId, code: { startsWith: `${prefix}-${year}-` } }, select: { code: true } });
    const created = await prisma.project.create({
      data: {
        divisionId: scope.divisionId,
        code: nextProjectCode(prefix, year, codes.map((c) => c.code)),
        name: v.name,
        startDate: v.startDate,
        endDate: v.endDate,
        budgetHours: v.budgetHours,
        status: v.status,
        statusChangedAt: now,
        statusChangedById: scope.userId,
        managerId: scope.userId,
        activities: { create: v.activities.map((name) => ({ name })) },
        members: { create: v.memberIds.map((userId) => ({ userId })) },
      },
    });
    await appendAudit({ actorId: scope.userId, actorLabel, divisionId: scope.divisionId, action: "PROJECT_CREATED", objectLabel: `${created.code} · ${created.name}`, result: "SUCCESS", metadata: { status: v.status } });
    return { id: created.id, name: created.name, code: created.code };
  }

  return prisma.$transaction(async (tx) => {
    const project = await findInScope(scope, id, tx);
    // Une activité qui porte déjà des heures ne peut pas être retirée.
    const removed = project.activities.filter((a) => !v.activities.includes(a.name));
    const inUse = removed.find((a) => a._count.lines > 0);
    if (inUse) throw new ProjectRuleError("activityInUse", { name: inUse.name });
    await tx.activity.deleteMany({ where: { id: { in: removed.map((a) => a.id) } } });
    const existing = new Set(project.activities.map((a) => a.name));
    await tx.activity.createMany({ data: v.activities.filter((n) => !existing.has(n)).map((name) => ({ projectId: project.id, name })) });
    // Membres : seuls ceux que le contexte peut affecter sont modifiés.
    await tx.projectMember.deleteMany({ where: { projectId: project.id, userId: { in: [...team].filter((u) => !v.memberIds.includes(u)) } } });
    const current = new Set(project.members.map((m) => m.userId));
    await tx.projectMember.createMany({ data: v.memberIds.filter((m) => !current.has(m)).map((userId) => ({ projectId: project.id, userId })) });
    const statusChanged = project.status !== v.status;
    await tx.project.update({
      where: { id: project.id },
      data: {
        name: v.name,
        startDate: v.startDate,
        endDate: v.endDate,
        budgetHours: v.budgetHours,
        status: v.status,
        ...(statusChanged ? { statusChangedAt: now, statusChangedById: scope.userId } : {}),
      },
    });
    await appendAudit({
      actorId: scope.userId,
      actorLabel,
      divisionId: scope.divisionId,
      action: statusChanged ? "PROJECT_STATUS_CHANGED" : "PROJECT_UPDATED",
      objectLabel: `${project.code} · ${v.name}`,
      result: "SUCCESS",
      metadata: statusChanged ? { from: project.status, to: v.status } : {},
    });
    return { id: project.id, name: v.name, code: project.code };
  });
}

/** Archivage depuis le panneau de modification ; réversible (« Annuler » ou « Sortir des archives »). */
export async function setProjectArchived(scope: DivisionScope, id: string, archived: boolean, now: Date, actorLabel: string) {
  const project = await findInScope(scope, id);
  await prisma.project.update({ where: { id: project.id }, data: { archivedAt: archived ? now : null } });
  await appendAudit({
    actorId: scope.userId,
    actorLabel,
    divisionId: scope.divisionId,
    action: archived ? "PROJECT_ARCHIVED" : "PROJECT_UNARCHIVED",
    objectLabel: `${project.code} · ${project.name}`,
    result: "SUCCESS",
  });
  return { name: project.name };
}
