// Adresses des écrans (PROMPT.md §10).
import { isValidIsoWeek, type IsoWeek } from "./iso-week";

export const entryHref = (w: IsoWeek) => `/saisie/${w.year}/${w.week}`;
export const attendanceHref = (year: number, month: number) => `/fiche-presence/${year}/${month}`;

/** Lit une semaine d'URL (« 2026 », « 12 ») ; null si elle n'existe pas. */
export function parseWeek(year: string | undefined, week: string | undefined): IsoWeek | null {
  if (!year || !week || !/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(week)) return null;
  const w = { year: Number(year), week: Number(week) };
  return isValidIsoWeek(w) ? w : null;
}
