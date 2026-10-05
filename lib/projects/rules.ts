// Règles de projet (PROMPT.md §9.4). Pures : la couche de données les applique
// côté serveur, l'interface les affiche.
import { formatHours } from "../format";
import { dict, t } from "../i18n";
import { statusLook, type ProjectStatus } from "../status";

export type ProjectDates = { startDate: Date; endDate: Date | null };

/** Seul un projet « En cours » accepte de nouvelles heures. */
export function acceptsTimeEntry(status: ProjectStatus): boolean {
  return status === "IN_PROGRESS";
}

/**
 * Une ligne de saisie s'ajoute seulement sur un projet dont on est membre,
 * « En cours », et dont la période couvre la semaine.
 */
export function canAddLine(input: {
  status: ProjectStatus;
  isMember: boolean;
  project: ProjectDates;
  weekStart: Date;
  weekEnd: Date;
}): boolean {
  const { project, weekStart, weekEnd } = input;
  const covers = project.startDate.getTime() <= weekEnd.getTime() && (project.endDate === null || project.endDate.getTime() >= weekStart.getTime());
  return input.isMember && acceptsTimeEntry(input.status) && covers;
}

/**
 * Enregistrement d'heures sur une ligne existante : refusé si le projet a quitté
 * « En cours ». Les heures déjà saisies restent, en lecture seule.
 */
export function canRecordHours(status: ProjectStatus): boolean {
  return acceptsTimeEntry(status);
}

/** Texte affiché à la place des heures quand la saisie n'est pas ouverte (tableau de bord). */
export function entryNotice(status: ProjectStatus): string | null {
  if (status === "IN_PROGRESS") return null;
  return status === "NOT_STARTED" ? dict.project.entryNotYetOpen : dict.project.entryClosedShort;
}

/** Message de statut après un changement : nouveau statut et effet sur la saisie. */
export function statusChangedMessage(name: string, status: ProjectStatus): string {
  return t(dict.project.statusChanged, {
    name,
    status: statusLook("project", status).label,
    effect: acceptsTimeEntry(status) ? dict.project.entryOpen : dict.project.entryClosed,
  });
}

/** « Date de fin dépassée » : le statut ne change jamais tout seul, le manager décide. */
export function endDatePassed(status: ProjectStatus, endDate: Date | null, today: Date): boolean {
  return status === "IN_PROGRESS" && endDate !== null && endDate.getTime() < today.getTime();
}

/** Consommation du budget : pourcentage et texte de dépassement, sans étiquette. */
export function budgetUsage(consumed: number, budget: number | null): { percent: number; overText: string | null } | null {
  if (budget === null || budget <= 0) return null;
  const percent = Math.round((consumed * 100) / budget);
  const over = consumed - budget;
  return { percent, overText: over > 0 ? t(dict.project.budgetOver, { hours: formatHours(over) }) : null };
}

/** Tri de la liste : par statut (En cours, À démarrer, En pause, Terminé), puis par code. */
const ORDER: ProjectStatus[] = ["IN_PROGRESS", "NOT_STARTED", "ON_HOLD", "DONE"];
export function compareProjects(a: { status: ProjectStatus; code: string }, b: { status: ProjectStatus; code: string }): number {
  return ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.code.localeCompare(b.code, "fr");
}
