// Règles du tableau de bord staff (PROMPT.md §9.1). Pures : la couche de données
// fournit les fiches, l'écran affiche ce qui en sort.
import { dict, t } from "../i18n";
import { formatDate, formatDayMonthYear } from "../format";
import { compareWeeks, shiftWeek, type IsoWeek } from "../iso-week";
import { displayStatus, type DisplayStatus, type StoredStatus } from "./rules";

export type WeekRecord = {
  week: IsoWeek;
  stored: StoredStatus | null;
  deadline: Date;
  hours: number;
  expected: number;
};

/** Semaines de `from` à `to` incluses, de la plus récente à la plus ancienne. */
export function weeksBack(to: IsoWeek, from: IsoWeek): IsoWeek[] {
  const out: IsoWeek[] = [];
  for (let w = to; compareWeeks(w, from) >= 0; w = shiftWeek(w, -1)) out.push(w);
  return out;
}

/**
 * Une ligne « À faire » par semaine manquante : échéance passée, fiche absente
 * ou encore en brouillon. Les semaines antérieures à l'arrivée ne comptent pas.
 */
export function missingWeeks<T extends WeekRecord>(records: T[], now: Date): T[] {
  return records.filter((r) => displayStatus(r.stored, r.deadline, now) === "MISSING");
}

/** Action proposée dans « Dernières semaines » (Continuer, Saisir, Consulter). */
export function historyAction(status: DisplayStatus, hours: number): "continue" | "enter" | "consult" {
  if (status === "SUBMITTED" || status === "VALIDATED") return "consult";
  if (status === "MISSING" && hours === 0) return "enter";
  return "continue";
}

export function actionLabel(action: "continue" | "enter" | "consult"): string {
  return { continue: dict.dashboard.actionContinue, enter: dict.dashboard.actionEnter, consult: dict.dashboard.actionConsult }[action];
}

/** « 2 actions », « 1 action ». */
export function todoCount(n: number): string {
  return t(n > 1 ? dict.dashboard.todoCountMany : dict.dashboard.todoCountOne, { n });
}

/**
 * Période d'un projet sous son code :
 * « jusqu'au 26 juin 2026 », « débute le 6 avril 2026 », « toute l'année 2026 ».
 */
export function projectPeriod(project: { startDate: Date; endDate: Date | null }, today: Date): string {
  const { startDate: start, endDate: end } = project;
  if (start.getTime() > today.getTime()) return t(dict.dashboard.startsOn, { date: formatDate(start) });
  const year = start.getUTCFullYear();
  const wholeYear =
    end !== null &&
    end.getUTCFullYear() === year &&
    start.getUTCMonth() === 0 && start.getUTCDate() === 1 &&
    end.getUTCMonth() === 11 && end.getUTCDate() === 31;
  if (wholeYear) return t(dict.dashboard.wholeYear, { year });
  if (end === null) return t(dict.dashboard.since, { date: formatDate(start) });
  return t(dict.dashboard.until, { date: formatDate(end) });
}

/** Version mobile, à la place des heures d'un projet qui n'a pas démarré : « Dès le 6 avril ». */
export function startsShort(start: Date, today: Date): string | null {
  if (start.getTime() <= today.getTime()) return null;
  return t(dict.dashboard.startsShort, { date: formatDayMonthYear(start, start.getUTCFullYear() !== today.getUTCFullYear()) });
}
