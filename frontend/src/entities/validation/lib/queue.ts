// File de validation (PROMPT.md §9.3, planche 07) : filtres Personne et Période, onglets par
// statut. Pur. Les clés de période sont celles de l'API (ValidationRules.PeriodWeeks).
import { dict, t } from "@/shared/i18n";
import { capitalize, formatRange } from "@/shared/lib/format";
import { addDays, compareWeeks, isoWeekOf, mondayOf, shiftWeek, type IsoWeek } from "@/shared/lib/iso-week";

export const QUEUE_TABS = ["SUBMITTED", "VALIDATED", "REJECTED", "ALL"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export function parseTab(raw: string | null | undefined): QueueTab {
  return (QUEUE_TABS as readonly string[]).includes(raw ?? "") ? (raw as QueueTab) : "SUBMITTED";
}

export type PeriodOption = { key: string; label: string };

export const DEFAULT_PERIOD = "4s";
const LAST_WEEKS = 4;

/**
 * Périodes proposées : les 4 dernières semaines (par défaut), chacune de ces semaines, le mois
 * en cours, le mois précédent, puis toutes les périodes. Une semaine appartient au mois de son lundi.
 */
export function periodOptions(current: IsoWeek): PeriodOption[] {
  const last = Array.from({ length: LAST_WEEKS }, (_, i) => shiftWeek(current, -i));
  const oldest = last[last.length - 1] ?? current;
  const monday = mondayOf(current);
  const months = [0, 1].map((back) => {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth() - back, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  return [
    { key: DEFAULT_PERIOD, label: t(dict.validation.lastWeeks, { from: oldest.week, to: current.week }) },
    ...last.map((w) => ({
      key: `s-${w.year}-${w.week}`,
      label: t(dict.week.labelWithRange, { week: w.week, range: formatRange(mondayOf(w), addDays(mondayOf(w), 4)) }),
    })),
    ...months.map(({ year, month }) => ({ key: `m-${year}-${month + 1}`, label: `${capitalize(dict.months[month] ?? "")} ${year}` })),
    { key: "tout", label: dict.validation.allPeriods },
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

/**
 * Étiquettes d'attention d'une ligne (docs/design-v2.md, §6) : ce qui demande un regard avant
 * de valider. Neutres, à côté du nom ; l'ordre est fixe.
 */
export function attentionTags(row: { submissionCount: number; hasComment: boolean; hasAbsence: boolean; unusualProject: boolean }): string[] {
  const a = dict.validation.attention;
  return [submissionTag(row.submissionCount), row.hasComment ? a.comment : null, row.hasAbsence ? a.absence : null, row.unusualProject ? a.unusualProject : null].filter(
    (x): x is string => x !== null,
  );
}
