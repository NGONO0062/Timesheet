// File de validation (PROMPT.md §9.3, planche 07) : filtres Personne et Période,
// onglets par statut. Pur : la couche de données applique, l'écran affiche.
import { capitalize, formatRange } from "../format";
import { dict, t } from "../i18n";
import { addDays, compareWeeks, isoWeekOf, mondayOf, shiftWeek, type IsoWeek } from "../iso-week";

export const QUEUE_TABS = ["SUBMITTED", "VALIDATED", "REJECTED", "ALL"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export function parseTab(raw: string | undefined): QueueTab {
  return (QUEUE_TABS as readonly string[]).includes(raw ?? "") ? (raw as QueueTab) : "SUBMITTED";
}

export type PeriodOption = { key: string; label: string; weeks: IsoWeek[] | null };

const LAST_WEEKS = 4;

/**
 * Périodes proposées : les 4 dernières semaines (par défaut), chacune de ces
 * semaines, le mois en cours, le mois précédent, puis toutes les périodes.
 * Une semaine appartient au mois de son lundi.
 */
export function periodOptions(current: IsoWeek): PeriodOption[] {
  const last = Array.from({ length: LAST_WEEKS }, (_, i) => shiftWeek(current, -i));
  const oldest = last[last.length - 1]!;
  const monday = mondayOf(current);
  const months = [0, 1].map((back) => {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth() - back, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  return [
    { key: "4s", label: t(dict.validation.lastWeeks, { from: oldest.week, to: current.week }), weeks: last },
    ...last.map((w) => ({
      key: `s-${w.year}-${w.week}`,
      label: t(dict.week.labelWithRange, { week: w.week, range: formatRange(mondayOf(w), addDays(mondayOf(w), 4)) }),
      weeks: [w],
    })),
    ...months.map(({ year, month }) => ({
      key: `m-${year}-${month + 1}`,
      label: `${capitalize(dict.months[month]!)} ${year}`,
      weeks: weeksOfMonth(year, month),
    })),
    { key: "tout", label: dict.validation.allPeriods, weeks: null },
  ];
}

/** Semaines ISO dont le lundi tombe dans le mois (0 = janvier). */
export function weeksOfMonth(year: number, month: number): IsoWeek[] {
  const out: IsoWeek[] = [];
  for (let d = new Date(Date.UTC(year, month, 1)); d.getUTCMonth() === month; d = addDays(d, 1)) {
    if (d.getUTCDay() === 1) {
      const w = isoWeekOf(d);
      if (!out.some((x) => compareWeeks(x, w) === 0)) out.push(w);
    }
  }
  return out;
}


/** « 2e soumission » à partir de la deuxième ; rien pour la première. */
export function submissionTag(count: number): string | null {
  return count >= 2 ? t(dict.validation.submission, { n: count }) : null;
}

/** « 2 fiches sélectionnées », « 1 fiche sélectionnée ». */
export function plural(n: number, one: string, many: string): string {
  return t(n > 1 ? many : one, { n });
}
