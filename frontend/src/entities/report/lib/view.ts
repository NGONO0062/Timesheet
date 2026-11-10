// Modèle de l'écran Reporting (planche 10), repris de lib/reporting/view.ts : l'API donne les
// chiffres (regroupements, indicateurs, couleurs de séries), ce module les met en forme. Pur.
import { dayOf } from "@/entities/timesheet";
import { dict, t } from "@/shared/i18n";
import { formatDays, formatFromTo, formatPercent, formatRange, NBSP } from "@/shared/lib/format";
import { addDays, mondayOf, shiftWeek, type IsoWeek } from "@/shared/lib/iso-week";
import type { Report } from "../api/types";

const r = dict.reporting;
export const WEEK_CHOICES = 12;
/** Hauteur des colonnes, en unités du dessin (le plus grand total la remplit). */
export const COLUMN_HEIGHT = 160;

export const weekKey = (w: IsoWeek) => `${w.year}-${w.week}`;

/** Semaines proposées dans « De la semaine » et « À la semaine » : les douze dernières. */
export function weekChoices(current: IsoWeek): Array<{ key: string; label: string }> {
  return Array.from({ length: WEEK_CHOICES }, (_, i) => shiftWeek(current, -i)).map((w) => ({
    key: weekKey(w),
    label: t(r.weekOption, { week: w.week, range: formatRange(mondayOf(w), addDays(mondayOf(w), 4)) }),
  }));
}

/** Part d'un total, une décimale : « 41,9 % » ; le total s'écrit « 100 % ». */
export function formatShare(part: number, total: number): string {
  if (total <= 0) return `0${NBSP}%`;
  const value = Math.round((part * 1000) / total) / 10;
  return `${value === 100 ? "100" : value.toFixed(1).replace(".", ",")}${NBSP}%`;
}

const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });

/** Textes des trois indicateurs (planche 10). */
export function kpiTexts(k: Report["kpis"]) {
  const missing = [k.missingDays > 0 ? t(r.notEntered, { hours: formatDays(k.missingDays) }) : r.nothingMissing];
  if (k.missingSheets > 0) missing.push(plural(k.missingSheets, r.missingSheetsOne, r.missingSheetsMany));
  return {
    entered: formatDays(k.entered),
    capacity: t(r.capacityOf, { capacity: formatDays(k.capacity), persons: plural(k.persons, r.personsOne, r.personsMany), weeks: plural(k.weeks, r.weeksOne, r.weeksMany) }),
    fill: formatPercent(k.capacity > 0 ? k.entered / k.capacity : 0),
    fillDetail: missing.join(" : "),
    validated: t(r.validatedOf, { n: k.validated, total: k.expectedSheets }),
    validatedDetail: [plural(k.pending, r.pendingOne, r.pendingMany), plural(k.missingSheets, r.missingOne, r.missingMany)].join(", "),
  };
}

export type ReportView = ReturnType<typeof buildReportView>;

export function buildReportView(report: Report) {
  const weeks = report.weeks;
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const period = first && last ? formatFromTo(dayOf(first.monday), addDays(dayOf(last.monday), 4)) : "";
  const periodLower = period.charAt(0).toLowerCase() + period.slice(1);

  // Une valeur par série (« Autres » regroupe le reste), dans l'ordre des couleurs.
  const perSeries = report.series
    .map((s) => {
      const members = report.entities.filter((e) => s.keys.includes(e.key));
      return { key: s.key, label: s.label, index: s.index, total: members.reduce((a, e) => a + e.total, 0), byWeek: weeks.map((_, j) => members.reduce((a, e) => a + (e.byWeek[j] ?? 0), 0)) };
    })
    .filter((s) => s.total > 0);
  const maxBar = Math.max(1, ...perSeries.map((s) => s.total));
  const weekTotals = weeks.map((_, j) => report.entities.reduce((a, e) => a + (e.byWeek[j] ?? 0), 0));
  const maxCol = Math.max(1, ...weekTotals);
  const grand = weekTotals.reduce((a, b) => a + b, 0);
  const selected = report.people.filter((p) => report.personId === null || p.id === report.personId).length;

  return {
    period,
    periodLower,
    empty: grand === 0,
    texts: kpiTexts(report.kpis),
    bars: perSeries.map((s) => ({ key: s.key, label: s.label, series: s.index, valueText: formatDays(s.total), width: Math.round((s.total * 100) / maxBar) })),
    columns: weeks.map((w, j) => ({
      key: `${w.year}-${w.week}`,
      label: w.open ? t(r.weekOpen, { week: w.week }) : t(r.weekLabel, { week: w.week }),
      open: w.open,
      totalText: formatDays(weekTotals[j] ?? 0),
      height: Math.round(((weekTotals[j] ?? 0) * COLUMN_HEIGHT) / maxCol),
      // De bas en haut : la première série en bas de la pile.
      segments: perSeries
        .filter((s) => (s.byWeek[j] ?? 0) > 0)
        .map((s) => ({ key: s.key, series: s.index, value: s.byWeek[j] ?? 0, title: t(r.segment, { label: s.label, week: w.week, hours: formatDays(s.byWeek[j] ?? 0) }) })),
    })),
    columnsAria: t(r.columnsAria, { items: weeks.map((w, j) => `${t(r.weekLabel, { week: w.week })}, ${formatDays(weekTotals[j] ?? 0)}`).join(" ; ") }),
    legend: perSeries.map((s) => ({ key: s.key, label: s.label, series: s.index })),
    capacityNote: t(r.capacityNote, { hours: formatDays(selected * (first?.capacity ?? 0)) }),
    table: {
      head: weeks.map((w) => t(r.weekLabel, { week: w.week })),
      rows: report.entities.map((e) => ({
        key: e.key,
        label: e.label,
        sub: e.sub,
        count: e.count,
        cells: e.byWeek.map((d) => formatDays(d)),
        total: formatDays(e.total),
        share: formatShare(e.total, grand),
      })),
      foot: { cells: weekTotals.map((d) => formatDays(d)), total: formatDays(grand), share: formatShare(grand, grand) },
    },
  };
}
