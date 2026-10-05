// Jours ouvrés de la division (PROMPT.md §9.3) : relance du validateur après N jours ouvrés.
import { addDays, isoWeekday, WEEKDAYS, type Weekday } from "../iso-week";

/** Le jour (minuit UTC) est-il ouvré : jour de travail de la division et pas férié ? */
export function isWorkingDay(day: Date, workingDays: readonly Weekday[], holidays: readonly Date[] = []): boolean {
  if (!workingDays.includes(WEEKDAYS[isoWeekday(day)]!)) return false;
  return !holidays.some((h) => h.getTime() === day.getTime());
}

/** Le n-ième jour ouvré après `day` (n ≥ 1). */
export function addWorkingDays(day: Date, n: number, workingDays: readonly Weekday[], holidays: readonly Date[] = []): Date {
  if (workingDays.length === 0) throw new Error("Aucun jour ouvré dans la division");
  let d = day;
  for (let left = n; left > 0; ) {
    d = addDays(d, 1);
    if (isWorkingDay(d, workingDays, holidays)) left--;
  }
  return d;
}

/**
 * Relance due : la fiche attend une décision depuis `afterDays` jours ouvrés
 * révolus (jour de soumission non compté), et aucune relance n'est partie depuis
 * la dernière soumission.
 */
export function reminderDue(input: {
  submittedDay: Date;
  today: Date;
  afterDays: number;
  workingDays: readonly Weekday[];
  holidays?: readonly Date[];
  alreadyReminded: boolean;
}): boolean {
  if (input.alreadyReminded) return false;
  const due = addWorkingDays(input.submittedDay, input.afterDays, input.workingDays, input.holidays);
  return input.today.getTime() > due.getTime();
}
