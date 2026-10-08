// Règles de projet (PROMPT.md §9.4). Pures : la couche de données les applique
// côté serveur, l'interface les affiche.
import { formatDate, formatHours, formatNumber, formatPercent, formatRange, parseFrDate } from "../format";
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

/** Période d'un projet dans la liste : « 5 janv. – 26 juin 2026 », « Toute l'année 2026 », « Depuis le 5 janvier 2026 ». */
export function projectPeriodLabel(start: Date, end: Date | null): string {
  const year = start.getUTCFullYear();
  if (end === null) return t(dict.project.since, { date: formatDate(start) });
  const whole = end.getUTCFullYear() === year && start.getUTCMonth() === 0 && start.getUTCDate() === 1 && end.getUTCMonth() === 11 && end.getUTCDate() === 31;
  return whole ? t(dict.project.wholeYear, { year }) : formatRange(start, end);
}

/** « 612 / 960 h · 64 % » ou « 148 h · sans budget ». */
export function consumedText(consumed: number, budget: number | null): string {
  const usage = budgetUsage(consumed, budget);
  if (!usage || budget === null) return t(dict.project.hoursNoBudget, { used: formatHours(consumed) });
  return t(dict.project.hoursBudget, { used: formatNumber(consumed), budget: formatHours(budget), percent: formatPercent(usage.percent / 100) });
}

/** « 7 projets · 4 en cours ». */
export function projectSummary(total: number, active: number): string {
  return t(total > 1 ? dict.project.summary : dict.project.summaryOne, { n: total, active });
}

/** Prochain code libre : « CX-2026-07 » (préfixe de la division, année de début, numéro sur deux chiffres). */
export function nextProjectCode(prefix: string, year: number, existing: readonly string[]): string {
  const head = `${prefix}-${year}-`;
  const used = existing.filter((c) => c.startsWith(head)).map((c) => Number(c.slice(head.length))).filter(Number.isInteger);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${head}${String(next).padStart(2, "0")}`;
}

export type ProjectInput = {
  name: string;
  start: string;
  end: string;
  status: ProjectStatus;
  budget: string;
  activities: string[];
  memberIds: string[];
};

export type ProjectFieldErrors = Partial<Record<"name" | "start" | "end" | "budget" | "activities", string>>;

export type CleanProject = {
  name: string;
  startDate: Date;
  endDate: Date | null;
  status: ProjectStatus;
  budgetHours: number | null;
  activities: string[];
  memberIds: string[];
};

/** Contrôle du panneau de création et de modification (mêmes règles côté serveur). */
export function checkProjectInput(input: ProjectInput): { ok: true; value: CleanProject } | { ok: false; errors: ProjectFieldErrors } {
  const errors: ProjectFieldErrors = {};
  const name = input.name.trim();
  if (!name || name.length > 120) errors.name = dict.project.errors.name;
  const startDate = parseFrDate(input.start);
  if (!startDate) errors.start = dict.project.errors.start;
  const endDate = input.end.trim() ? parseFrDate(input.end) : null;
  if (input.end.trim() && (!endDate || (startDate && endDate.getTime() < startDate.getTime()))) errors.end = dict.project.errors.end;
  const budgetRaw = input.budget.trim().replace(/\s/g, "");
  const budgetHours = budgetRaw === "" ? null : /^\d{1,6}$/.test(budgetRaw) ? Number(budgetRaw) : NaN;
  if (Number.isNaN(budgetHours)) errors.budget = dict.project.errors.budget;
  const activities = [...new Set(input.activities.map((a) => a.trim()).filter(Boolean))];
  if (activities.length === 0 || activities.some((a) => a.length > 80)) errors.activities = dict.project.errors.activities;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, startDate: startDate!, endDate, status: input.status, budgetHours, activities, memberIds: [...new Set(input.memberIds)] },
  };
}
