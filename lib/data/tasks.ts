import "server-only";
// Tâches d'un projet, sur son tableau Kanban (PROMPT.md §9.12). Un tableau se lit et
// s'écrit par les membres du projet (permission « Saisir ses temps ») et par ceux qui
// le gèrent (« Gérer les projets », même portée que l'écran Projets). Jamais par une
// autre division.
import type { Prisma } from "@prisma/client";
import type { ProjectStatus, TaskStatus } from "@/lib/status";
import { boardEditable, bottomPosition, checkTaskTitle } from "@/lib/tasks/rules";
import { AccessDenied, assertScope, prisma, type DivisionScope } from "./db";
import { managedProjectsWhere } from "./projects";

export class TaskRuleError extends Error {
  constructor(public readonly code: "notFound" | "readOnly" | "invalid", public readonly detail = "") {
    super(`Règle de tâche : ${code}`);
    this.name = "TaskRuleError";
  }
}

/** Projets dont le contexte peut ouvrir le tableau. */
function boardProjectsWhere(scope: DivisionScope): Prisma.ProjectWhereInput {
  assertScope(scope);
  const base: Prisma.ProjectWhereInput = { divisionId: scope.divisionId, isSystem: false };
  const or: Prisma.ProjectWhereInput[] = [];
  if (scope.permissions.has("ENTER_TIME")) or.push({ members: { some: { userId: scope.userId } } });
  if (scope.permissions.has("MANAGE_PROJECTS")) {
    const managed = managedProjectsWhere(scope);
    // Owner et admin de division : tous les projets de la division.
    if (Object.keys(managed).length === 0) return base;
    or.push(managed);
  }
  if (!or.length) throw new AccessDenied("ni ENTER_TIME ni MANAGE_PROJECTS");
  return { ...base, OR: or };
}

export type BoardProject = { id: string; code: string; name: string; status: ProjectStatus; archived: boolean };

/** Projets ouverts au tableau : en cours d'abord, puis par code ; archivés à la fin. */
export async function listBoardProjects(scope: DivisionScope): Promise<BoardProject[]> {
  const projects = await prisma.project.findMany({
    where: boardProjectsWhere(scope),
    select: { id: true, code: true, name: true, status: true, archivedAt: true },
    orderBy: { code: "asc" },
  });
  const rank = (p: { status: ProjectStatus; archivedAt: Date | null }) => (p.archivedAt ? 2 : p.status === "IN_PROGRESS" ? 0 : 1);
  return projects
    .sort((a, b) => rank(a) - rank(b))
    .map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, archived: p.archivedAt !== null }));
}

export type BoardTask = { id: string; title: string; status: TaskStatus; position: number; createdBy: string };

/** Cartes du tableau d'un projet de la portée, hors tâches supprimées. */
export async function getBoard(scope: DivisionScope, projectId: string): Promise<BoardTask[]> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ...boardProjectsWhere(scope) }, select: { id: true } });
  if (!project) throw new TaskRuleError("notFound");
  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, divisionId: scope.divisionId, deletedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, status: true, position: true, createdBy: { select: { firstName: true, lastName: true } } },
  });
  return tasks.map((x) => ({ id: x.id, title: x.title, status: x.status, position: x.position, createdBy: `${x.createdBy.firstName} ${x.createdBy.lastName}` }));
}

async function editableProject(scope: DivisionScope, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, ...boardProjectsWhere(scope) }, select: { id: true, status: true, archivedAt: true } });
  if (!project) throw new TaskRuleError("notFound");
  if (!boardEditable({ status: project.status, archived: project.archivedAt !== null })) throw new TaskRuleError("readOnly");
  return project;
}

/** Tâche de la portée, sur un tableau modifiable ; `withDeleted` pour « Annuler » une suppression. */
async function editableTask(scope: DivisionScope, taskId: string, withDeleted = false) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, divisionId: scope.divisionId, ...(withDeleted ? {} : { deletedAt: null }), project: boardProjectsWhere(scope) },
    select: { id: true, projectId: true, title: true, status: true, position: true },
  });
  if (!task) throw new TaskRuleError("notFound");
  await editableProject(scope, task.projectId);
  return task;
}

async function bottomOf(projectId: string, status: TaskStatus, exceptId?: string) {
  const rows = await prisma.task.findMany({ where: { projectId, status, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { position: true } });
  return bottomPosition(rows.map((r) => r.position));
}

/** Nouvelle tâche, en bas de la colonne Backlog. */
export async function createTask(scope: DivisionScope, projectId: string, rawTitle: string, now: Date) {
  const checked = checkTaskTitle(rawTitle);
  if (!checked.ok) throw new TaskRuleError("invalid", checked.error);
  const project = await editableProject(scope, projectId);
  const task = await prisma.task.create({
    data: {
      divisionId: scope.divisionId,
      projectId: project.id,
      title: checked.value,
      status: "BACKLOG",
      position: await bottomOf(project.id, "BACKLOG"),
      createdById: scope.userId,
      createdAt: now,
    },
  });
  return { id: task.id, title: task.title };
}

/**
 * Déplacement : en bas de la colonne choisie, ou à `position` pour « Annuler ».
 * Renvoie la place d'origine.
 */
export async function moveTask(scope: DivisionScope, taskId: string, status: TaskStatus, position?: number) {
  const task = await editableTask(scope, taskId);
  const target = position ?? (await bottomOf(task.projectId, status, task.id));
  await prisma.task.update({ where: { id: task.id }, data: { status, position: target } });
  return { title: task.title, previous: { status: task.status, position: task.position } };
}

export async function renameTask(scope: DivisionScope, taskId: string, rawTitle: string) {
  const checked = checkTaskTitle(rawTitle);
  if (!checked.ok) throw new TaskRuleError("invalid", checked.error);
  const task = await editableTask(scope, taskId);
  await prisma.task.update({ where: { id: task.id }, data: { title: checked.value } });
  return { title: checked.value, previous: task.title };
}

/** Suppression réversible : la tâche est marquée, « Annuler » la remet à sa place. */
export async function setTaskDeleted(scope: DivisionScope, taskId: string, deleted: boolean, now: Date) {
  const task = await editableTask(scope, taskId, true);
  await prisma.task.update({ where: { id: task.id }, data: { deletedAt: deleted ? now : null } });
  return { title: task.title };
}
