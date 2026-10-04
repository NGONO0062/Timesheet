// Règles de saisie hebdomadaire (PROMPT.md §9.2). Les valeurs (heures par jour,
// pas, jours ouvrés, échéance) viennent toujours de DivisionSettings.
import { dict, t } from "../i18n";
import { formatDayList, formatHours, formatWeekdayDay, formatNumber } from "../format";
import { addDays, mondayOf, WEEKDAYS, type IsoWeek, type Weekday } from "../iso-week";

export type EntryRules = {
  hoursPerDay: number;
  step: number;
  workingDays: readonly Weekday[];
};

export type DeadlineRules = {
  deadlineDay: Weekday;
  deadlineTime: string; // « 18:00 »
};

/** Décalage du fuseau Africa/Douala (UTC+1, sans heure d'été). */
const DOUALA_OFFSET_MIN = 60;
const MAX_HOURS_PER_CELL = 24;
const EPSILON = 1e-9;

export type ParsedHours =
  | { kind: "empty" }
  | { kind: "ok"; value: number }
  | { kind: "invalid" };

/** Lit une cellule : nombre positif, multiple du pas, virgule ou point décimal. */
export function parseHours(raw: string, step: number): ParsedHours {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return { kind: "empty" };
  if (!/^\d+([.,]\d+)?$/.test(s)) return { kind: "invalid" };
  const value = Number(s.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > MAX_HOURS_PER_CELL) return { kind: "invalid" };
  if (!isMultipleOf(value, step)) return { kind: "invalid" };
  return { kind: "ok", value };
}

export function isMultipleOf(value: number, step: number): boolean {
  const q = value / step;
  return Math.abs(q - Math.round(q)) < EPSILON;
}

export function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** Totaux par jour : `cells[ligne][jour]`. */
export function dayTotals(cells: number[][], dayCount: number): number[] {
  return Array.from({ length: dayCount }, (_, j) => sum(cells.map((row) => row[j] ?? 0)));
}

export type DayStatus = "UPCOMING" | "TODO" | "PARTIAL" | "COMPLETE" | "OVER" | "TO_FIX";

/**
 * Statut d'un jour, affiché en badge sous le total.
 * « À corriger » l'emporte : le manager a signalé une cellule de ce jour.
 */
export function dayStatus(input: { total: number; expected: number; isFuture?: boolean; flagged?: boolean }): DayStatus {
  const { total, expected } = input;
  if (input.flagged) return "TO_FIX";
  if (total > expected + EPSILON) return "OVER";
  if (Math.abs(total - expected) < EPSILON) return "COMPLETE";
  if (total === 0) return input.isFuture ? "UPCOMING" : "TODO";
  return "PARTIAL";
}

export type SubmitCheck = { canSubmit: boolean; message: string };

/**
 * Le bouton Soumettre n'est actif que si chaque jour ouvré totalise exactement
 * les heures attendues. Sinon, la raison est écrite à côté.
 */
export function submitCheck(days: Date[], totals: number[], expected: number[]): SubmitCheck {
  const over = days.filter((_, j) => (totals[j] ?? 0) > (expected[j] ?? 0) + EPSILON);
  if (over.length) {
    const cap = Math.max(...expected);
    return { canSubmit: false, message: t(dict.grid.over, { expected: formatHours(cap), days: formatDayList(over) }) };
  }
  const under = days.filter((_, j) => (totals[j] ?? 0) < (expected[j] ?? 0) - EPSILON);
  if (under.length) {
    const missing = sum(expected) - sum(totals);
    return { canSubmit: false, message: t(dict.grid.remaining, { hours: formatHours(missing), days: formatDayList(under) }) };
  }
  return { canSubmit: true, message: dict.grid.ready };
}

/** « Mercredi 18 mars : 10 h saisies pour 8 h attendues. Retirez 2 h avant de soumettre. » */
export function overDayMessage(day: Date, total: number, expected: number): string {
  const label = formatWeekdayDay(day);
  const month = dict.months[day.getUTCMonth()] ?? "";
  return t(dict.grid.overDay, {
    day: `${label.charAt(0).toUpperCase()}${label.slice(1)} ${month}`,
    hours: formatHours(total),
    expected: formatHours(expected),
    excess: formatHours(total - expected),
  });
}

/** Heures attendues par jour ouvré : 0 pour un jour férié de la division. */
export function expectedPerDay(days: Date[], hoursPerDay: number, holidays: Date[] = []): number[] {
  const off = new Set(holidays.map((d) => d.getTime()));
  return days.map((d) => (off.has(d.getTime()) ? 0 : hoursPerDay));
}

/** Instant de l'échéance d'une semaine : jour et heure réglés par la division, à Douala. */
export function weekDeadline(week: IsoWeek, rules: DeadlineRules): Date {
  const index = WEEKDAYS.indexOf(rules.deadlineDay);
  // « Lundi suivant » : l'échéance tombe la semaine d'après.
  const offsetDays = index === 0 ? 7 : index;
  const day = addDays(mondayOf(week), offsetDays);
  const [h, m] = rules.deadlineTime.split(":").map(Number);
  return new Date(day.getTime() + ((h ?? 0) * 60 + (m ?? 0) - DOUALA_OFFSET_MIN) * 60_000);
}

export type StoredStatus = "DRAFT" | "SUBMITTED" | "REJECTED" | "VALIDATED";
export type DisplayStatus = StoredStatus | "MISSING";

/** « Manquante » n'est pas stocké : échéance passée, fiche absente ou encore en brouillon. */
export function displayStatus(stored: StoredStatus | null, deadline: Date, now: Date): DisplayStatus {
  const late = now.getTime() > deadline.getTime();
  if (stored === null) return late ? "MISSING" : "DRAFT";
  if (stored === "DRAFT" && late) return "MISSING";
  return stored;
}

export function formatCell(value: number): string {
  return formatNumber(value);
}
