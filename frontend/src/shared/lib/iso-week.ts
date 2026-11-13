// Semaines ISO 8601 (lundi = premier jour, semaine 1 = celle du premier jeudi).
// Les jours sont des dates sans heure, représentées à minuit UTC.
import { TIMEZONE } from "./format";

export type IsoWeek = { year: number; week: number };

export const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DAY_MS = 86_400_000;

export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** 0 = lundi … 6 = dimanche */
export function isoWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function isoWeekOf(d: Date): IsoWeek {
  const thursday = addDays(d, 3 - isoWeekday(d));
  const year = thursday.getUTCFullYear();
  const jan1 = utcDate(year, 1, 1);
  const week = 1 + Math.floor((thursday.getTime() - jan1.getTime()) / DAY_MS / 7);
  return { year, week };
}

/** Nombre de semaines ISO de l'année (52 ou 53). */
export function weeksInIsoYear(year: number): number {
  return isoWeekOf(utcDate(year, 12, 28)).week;
}

export function mondayOf({ year, week }: IsoWeek): Date {
  const jan4 = utcDate(year, 1, 4);
  const week1Monday = addDays(jan4, -isoWeekday(jan4));
  return addDays(week1Monday, (week - 1) * 7);
}

export function shiftWeek(w: IsoWeek, delta: number): IsoWeek {
  return isoWeekOf(addDays(mondayOf(w), delta * 7));
}

export function compareWeeks(a: IsoWeek, b: IsoWeek): number {
  return a.year !== b.year ? a.year - b.year : a.week - b.week;
}

export function isValidIsoWeek(w: IsoWeek): boolean {
  return Number.isInteger(w.year) && Number.isInteger(w.week) && w.week >= 1 && w.week <= weeksInIsoYear(w.year);
}

/** Jours ouvrés de la semaine, dans l'ordre (réglage de la division). */
export function workingDaysOf(w: IsoWeek, workingDays: readonly Weekday[]): Date[] {
  const monday = mondayOf(w);
  return WEEKDAYS.map((name, i) => ({ name, date: addDays(monday, i) }))
    .filter((d) => workingDays.includes(d.name))
    .map((d) => d.date);
}

/** Date du jour dans le fuseau de la division, à minuit UTC. */
export function todayInDivision(now: Date = new Date()): Date {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(now).split("-").map(Number);
  return utcDate(y ?? 1970, m ?? 1, d ?? 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}
