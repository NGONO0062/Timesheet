// Règles du tableau Kanban (PROMPT.md §9.12). Pures : la couche de données les
// applique côté serveur, l'interface les affiche.
import { dict, t } from "../i18n";
import { DMAIC_PHASES, isDmaicPhase, phaseLabel, type DmaicPhase } from "../projects/dmaic";
import { statusLook, TASK_STATUS_ORDER, type ProjectStatus, type TaskStatus } from "../status";

export const TASK_TITLE_MAX = 140;

export type TitleCheck = { ok: true; value: string } | { ok: false; error: string };

/** Titre d'une tâche : espaces superflus retirés, non vide, 140 caractères au plus. */
export function checkTaskTitle(raw: string): TitleCheck {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: dict.tasks.errors.titleEmpty };
  if (value.length > TASK_TITLE_MAX) return { ok: false, error: t(dict.tasks.errors.titleLong, { max: TASK_TITLE_MAX }) };
  return { ok: true, value };
}

/** Un projet terminé ou archivé garde son tableau en lecture seule. */
export function boardEditable(project: { status: ProjectStatus; archived: boolean }): boolean {
  return project.status !== "DONE" && !project.archived;
}

/** Raison écrite au-dessus d'un tableau en lecture seule ; null s'il est modifiable. */
export function readOnlyReason(project: { status: ProjectStatus; archived: boolean }): string | null {
  if (project.archived) return dict.tasks.readOnlyArchived;
  if (project.status === "DONE") return dict.tasks.readOnlyDone;
  return null;
}

/** Position d'une carte posée en bas d'une colonne. */
export function bottomPosition(positions: number[]): number {
  return positions.length ? Math.max(...positions) + 1 : 0;
}

export type TaskCard = { id: string; status: TaskStatus; position: number };

/** Cartes d'une colonne, de haut en bas. */
export function columnOf<T extends TaskCard>(tasks: T[], status: TaskStatus): T[] {
  return tasks.filter((x) => x.status === status).sort((a, b) => a.position - b.position);
}

/**
 * Déplacement vu tout de suite à l'écran, avant la réponse du serveur : la carte
 * passe en bas de la colonne choisie. Même résultat que la couche de données.
 */
export function moveLocally<T extends TaskCard>(tasks: T[], id: string, status: TaskStatus, position?: number): T[] {
  const target = position ?? bottomPosition(tasks.filter((x) => x.status === status && x.id !== id).map((x) => x.position));
  return tasks.map((x) => (x.id === id ? { ...x, status, position: target } : x));
}

/** Nom accessible d'une colonne : « En cours, 2 tâches ». */
export function columnLabel(status: TaskStatus, n: number): string {
  return t(n > 1 ? dict.tasks.columnMany : dict.tasks.columnOne, { status: statusLook("task", status).label, n });
}

/** Message après un déplacement : « « Maquette » déplacée dans « En cours ». » */
export function movedMessage(title: string, status: TaskStatus): string {
  return t(dict.tasks.moved, { title, status: statusLook("task", status).label });
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUS_ORDER as string[]).includes(value);
}

/** Filtre « Phase » d'un tableau DMAIC : toutes, une phase, ou les tâches sans phase. */
export type PhaseFilter = "ALL" | "NONE" | DmaicPhase;

/** Filtre lu dans l'adresse (`?phase=ANALYZE`, `?phase=aucune`) ; « toutes » sinon. */
export function parsePhaseFilter(raw: string | undefined): PhaseFilter {
  if (raw === "aucune") return "NONE";
  return isDmaicPhase(raw) ? raw : "ALL";
}

export function phaseFilterParam(filter: PhaseFilter): string | null {
  return filter === "ALL" ? null : filter === "NONE" ? "aucune" : filter;
}

export function matchesPhase(task: { phase: DmaicPhase | null }, filter: PhaseFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "NONE") return task.phase === null;
  return task.phase === filter;
}

/**
 * Boutons du filtre, avec leur compte : « Toutes les phases (7) », une par phase,
 * puis « Sans phase (n) » seulement s'il y a des tâches sans phase (créées avant
 * que le projet devienne DMAIC).
 */
export function phaseFilterOptions(tasks: ReadonlyArray<{ phase: DmaicPhase | null }>): Array<{ value: PhaseFilter; label: string }> {
  const count = (f: PhaseFilter) => tasks.filter((x) => matchesPhase(x, f)).length;
  const none = count("NONE");
  return [
    { value: "ALL" as PhaseFilter, label: t(dict.tasks.phaseAll, { n: tasks.length }) },
    ...DMAIC_PHASES.map((ph) => ({ value: ph as PhaseFilter, label: t(dict.tasks.phaseOption, { phase: phaseLabel(ph), n: count(ph) }) })),
    ...(none > 0 ? [{ value: "NONE" as PhaseFilter, label: t(dict.tasks.phaseNone, { n: none }) }] : []),
  ];
}
