// Règles d'affichage des projets (reprises de lib/projects/rules.ts). Le serveur garde
// les règles qui décident ; celles-ci servent aux messages de l'écran et au contrôle du
// panneau avant l'envoi (mêmes règles que ProjectRules côté API).
import { dict, t } from "@/shared/i18n";
import { formatDate, formatDays, formatNumber, formatPercent, formatRange, parseFrDate } from "@/shared/lib/format";
import { PROJECT_STATUS_ORDER, statusLook, type ProjectStatus } from "@/shared/lib/status";

/** Seul un projet « En cours » ouvre la saisie des temps à ses membres. */
export function acceptsTimeEntry(status: ProjectStatus): boolean {
  return status === "IN_PROGRESS";
}

/** Message de statut après un changement : nouveau statut et effet sur la saisie. */
export function statusChangedMessage(name: string, status: ProjectStatus): string {
  return t(dict.project.statusChanged, {
    name,
    status: statusLook("project", status).label,
    effect: acceptsTimeEntry(status) ? dict.project.entryOpen : dict.project.entryClosed,
  });
}

/** Consommation du budget : pourcentage et texte de dépassement, sans étiquette (une ligne, une étiquette). */
export function budgetUsage(consumed: number, budget: number | null): { percent: number; overText: string | null } | null {
  if (budget === null || budget <= 0) return null;
  const percent = Math.round((consumed * 100) / budget);
  const over = consumed - budget;
  return { percent, overText: over > 0 ? t(dict.project.budgetOver, { hours: formatDays(over) }) : null };
}

/** Tri de la liste : par statut (En cours, À démarrer, En pause, Terminé), puis par code. */
export function compareProjects(a: { status: ProjectStatus; code: string }, b: { status: ProjectStatus; code: string }): number {
  return PROJECT_STATUS_ORDER.indexOf(a.status) - PROJECT_STATUS_ORDER.indexOf(b.status) || a.code.localeCompare(b.code, "fr");
}

/** Période d'un projet : « 5 janv. – 26 juin 2026 », « Toute l'année 2026 », « Depuis le 5 janvier 2026 ». */
export function projectPeriodLabel(start: Date, end: Date | null): string {
  const year = start.getUTCFullYear();
  if (end === null) return t(dict.project.since, { date: formatDate(start) });
  const whole = end.getUTCFullYear() === year && start.getUTCMonth() === 0 && start.getUTCDate() === 1 && end.getUTCMonth() === 11 && end.getUTCDate() === 31;
  return whole ? t(dict.project.wholeYear, { year }) : formatRange(start, end);
}

/** « 612 / 960 jours · 64 % » ou « 148 jours · sans budget ». */
export function consumedText(consumed: number, budget: number | null): string {
  const usage = budgetUsage(consumed, budget);
  if (!usage || budget === null) return t(dict.project.hoursNoBudget, { used: formatDays(consumed) });
  return t(dict.project.hoursBudget, { used: formatNumber(consumed), budget: formatDays(budget), percent: formatPercent(usage.percent / 100) });
}

/** « 7 projets · 4 en cours ». */
export function projectSummary(total: number, active: number): string {
  return t(total > 1 ? dict.project.summary : dict.project.summaryOne, { n: total, active });
}

/** Saisie du panneau, telle que tapée (dates jj/mm/aaaa, budget en texte). */
export type ProjectForm = { name: string; start: string; end: string; status: ProjectStatus; budget: string; activities: string[]; memberIds: string[] };

export type ProjectField = "name" | "start" | "end" | "budget" | "activities";
export type ProjectFieldErrors = Partial<Record<ProjectField, string>>;

/** Corps envoyé à l'API : dates ISO, budget entier ou null. */
export type ProjectPayload = { name: string; start: string; end: string | null; status: ProjectStatus; budget: number | null; activities: string[]; memberIds: string[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Contrôle du panneau de création et de modification (mêmes règles que l'API). */
export function checkProjectForm(input: ProjectForm): { ok: true; value: ProjectPayload } | { ok: false; errors: ProjectFieldErrors } {
  const e = dict.project.errors;
  const errors: ProjectFieldErrors = {};
  const name = input.name.trim();
  if (!name || name.length > 120) errors.name = e.name;
  const start = parseFrDate(input.start);
  if (!start) errors.start = e.start;
  const end = input.end.trim() ? parseFrDate(input.end) : null;
  if (input.end.trim() && (!end || (start && end.getTime() < start.getTime()))) errors.end = e.end;
  const budgetRaw = input.budget.trim().replace(/\s/g, "");
  const budget = budgetRaw === "" ? null : /^\d{1,6}$/.test(budgetRaw) ? Number(budgetRaw) : NaN;
  if (Number.isNaN(budget)) errors.budget = e.budget;
  const activities = [...new Set(input.activities.map((a) => a.trim()).filter(Boolean))];
  if (activities.length === 0 || activities.some((a) => a.length > 80)) errors.activities = e.activities;
  if (Object.keys(errors).length > 0 || !start) return { ok: false, errors };
  return { ok: true, value: { name, start: iso(start), end: end ? iso(end) : null, status: input.status, budget, activities, memberIds: [...new Set(input.memberIds)] } };
}

/** Erreurs renvoyées par l'API (« fields » d'un 422) traduites en messages de champ. */
export function fieldErrors(fields: readonly string[]): ProjectFieldErrors {
  const e = dict.project.errors;
  const out: ProjectFieldErrors = {};
  for (const f of fields) if (f === "name" || f === "start" || f === "end" || f === "budget" || f === "activities") out[f] = e[f];
  return out;
}
