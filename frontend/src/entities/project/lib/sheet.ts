// Fiche projet : règles d'affichage pures (phrases des points d'attention, parts, tendance).
// Les calculs de fond (consommé, budget, délai, points d'attention) sont faits par l'API.
import { dict, t } from "@/shared/i18n";
import { formatDate, formatDays, formatNumber, formatPercent } from "@/shared/lib/format";
import type { ProjectSheet } from "../api/queries";

const s = dict.projectSheet;

/** Hauteur d'une colonne de la tendance, comme les autres graphiques en colonnes. */
const TREND_HEIGHT = 160;

export type AttentionCode = ProjectSheet["attention"][number];

/** Gravité d'un point d'attention : le dépassement est une erreur, le reste un avertissement. */
export function attentionTone(code: AttentionCode): "danger" | "warning" {
  return code === "overBudget" ? "danger" : "warning";
}

/** Phrase d'un point d'attention, avec les chiffres du projet. */
export function attentionText(code: AttentionCode, p: Pick<ProjectSheet, "budget" | "consumed" | "budgetPercent" | "elapsedPercent" | "start" | "end" | "lastDay">): string {
  switch (code) {
    case "overBudget":
      return t(s.attention.overBudget, { over: formatDays(p.consumed - (p.budget ?? 0)), consumed: formatDays(p.consumed), budget: formatDays(p.budget ?? 0) });
    case "endPassed":
      return t(s.attention.endPassed, { date: p.end ? formatDate(new Date(p.end)) : "" });
    case "budgetAhead":
      return t(s.attention.budgetAhead, { budget: formatPercent((p.budgetPercent ?? 0) / 100), elapsed: formatPercent((p.elapsedPercent ?? 0) / 100) });
    case "quiet":
      return p.lastDay ? t(s.attention.quiet, { date: formatDate(new Date(p.lastDay)) }) : t(s.attention.quietNever, { date: formatDate(new Date(p.start)) });
  }
}

/** Part d'un total, en pour cent entier ; 0 quand le total est nul. */
export function shareOf(days: number, total: number): number {
  return total > 0 ? Math.round((days * 100) / total) : 0;
}

/** Budget : « 12 / 30 jours », ou « 12 jours » sans budget. */
export function budgetValue(consumed: number, budget: number | null): string {
  return budget === null || budget <= 0 ? formatDays(consumed) : `${formatNumber(consumed)} / ${formatDays(budget)}`;
}

/** Sous le budget : part consommée et reste, dépassement, ou absence de budget. */
export function budgetDetail(consumed: number, budget: number | null, percent: number | null): string {
  if (budget === null || budget <= 0 || percent === null) return s.noBudget;
  const used = formatPercent(percent / 100);
  return consumed > budget ? t(s.budgetOver, { percent: used, over: formatDays(consumed - budget) }) : t(s.budgetLeft, { percent: used, left: formatDays(budget - consumed) });
}

/** Tâches : « 4 sur 10 terminées », « 1 sur 1 terminée », « Aucune tâche ». */
export function tasksValue(tasks: ProjectSheet["tasks"]): string {
  if (tasks.total === 0) return s.tasksNone;
  return t(tasks.done > 1 ? s.tasksDoneMany : s.tasksDoneOne, { done: tasks.done, total: tasks.total });
}

/** Tâches par colonne du tableau, de gauche à droite, avec les libellés du tableau. */
export function tasksByColumn(tasks: ProjectSheet["tasks"]): Array<{ key: string; label: string; count: number }> {
  const labels = dict.status.task;
  return [
    { key: "BACKLOG", label: labels.BACKLOG, count: tasks.backlog },
    { key: "TODO", label: labels.TODO, count: tasks.todo },
    { key: "IN_PROGRESS", label: labels.IN_PROGRESS, count: tasks.inProgress },
    { key: "REVIEW", label: labels.REVIEW, count: tasks.review },
    { key: "DONE", label: labels.DONE, count: tasks.done },
  ];
}

/** Colonnes de la tendance : la plus haute semaine prend toute la hauteur ; la semaine en cours est évidée. */
export function sheetTrendColumns(weeks: ProjectSheet["weeks"]) {
  const max = Math.max(1, ...weeks.map((w) => w.days));
  return weeks.map((w, i) => {
    const open = i === weeks.length - 1;
    return {
      key: `${w.year}-${w.week}`,
      label: t(s.trendWeek, { week: w.week }),
      open,
      totalText: formatNumber(w.days),
      height: Math.round((w.days * TREND_HEIGHT) / max),
      title: t(open ? s.trendMarkOpen : s.trendMark, { week: w.week, days: formatDays(w.days) }),
    };
  });
}
