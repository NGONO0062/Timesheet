// Fiche de présence mensuelle (PROMPT.md §9.7, §20). Règles pures : contenu de la
// feuille, semaines du mois, nom du fichier, étape du circuit.
import { capitalize, formatFrDate } from "../format";
import { dict } from "../i18n";
import { addDays, isoWeekOf, isoWeekday, utcDate, type IsoWeek } from "../iso-week";
import type { AttendanceStatus } from "../status";
import { SHEET_TEMPLATE } from "./config";

export type InternshipKind = "ACADEMIC" | "PROFESSIONAL" | "GRADUATE";

/** Heures validées d'un jour : total, dont l'activité système « Absence ». */
export type DayHours = { date: Date; hours: number; absence: number };

export type SheetInput = {
  year: number;
  /** 1 à 12. */
  month: number;
  firstName: string;
  lastName: string;
  internship: { kind: InternshipKind; direction: string; department: string; service: string; startDate: Date; endDate: Date };
  arrival: string;
  departure: string;
  days: DayHours[];
  observation?: string | null;
};

export type SheetRow = { label: string; arrival: string; departure: string };
export type SheetBlock = { rows: SheetRow[]; used: boolean };

export type SheetModel = {
  name: string;
  kind: InternshipKind;
  direction: string;
  department: string;
  service: string;
  from: string;
  to: string;
  blocks: SheetBlock[];
  absenceDays: number;
  observation: string;
};

/** Jour ouvré du lundi au vendredi : la feuille n'a pas de ligne pour le week-end. */
const WEEKDAY_COUNT = 5;

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

/** Lundis des semaines qui contiennent au moins un jour ouvré du mois. */
export function mondaysOfMonth(year: number, month: number): Date[] {
  const first = utcDate(year, month, 1);
  const last = utcDate(year, month + 1, 0);
  const mondays: Date[] = [];
  for (let monday = addDays(first, -isoWeekday(first)); monday <= last; monday = addDays(monday, 7)) {
    const weekdays = Array.from({ length: WEEKDAY_COUNT }, (_, i) => addDays(monday, i));
    if (weekdays.some((d) => d >= first && d <= last)) mondays.push(monday);
  }
  return mondays;
}

/**
 * Semaines ISO du mois : la fiche est générée quand elles sont toutes validées. Avec
 * la période de stage, seules les semaines qui la recoupent comptent (un stage qui
 * commence le 5 janvier n'attend pas la semaine du 29 décembre).
 */
export function weeksOfMonth(year: number, month: number, within?: { startDate: Date; endDate: Date }): IsoWeek[] {
  return mondaysOfMonth(year, month)
    .filter((monday) => !within || (addDays(monday, WEEKDAY_COUNT - 1) >= within.startDate && monday <= within.endDate))
    .map(isoWeekOf);
}

/** Mois (1 à 12) dont les jours ouvrés touchent une semaine : une semaine à cheval en a deux. */
export function monthsOfWeek(monday: Date): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < WEEKDAY_COUNT; i++) {
    const d = addDays(monday, i);
    const m = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    if (!out.some((x) => x.year === m.year && x.month === m.month)) out.push(m);
  }
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const DOTS = { short: "............", long: "........" };

function emptyRow(i: number): SheetRow {
  const day = capitalize(dict.weekdays[i]!);
  return { label: `${day} ${day.length > 5 ? DOTS.long : DOTS.short}`, arrival: "", departure: "" };
}

/**
 * Contenu de la feuille. Arrivée et départ : les horaires habituels du stagiaire, pour
 * chaque jour du mois où il a des heures validées hors absence. Un jour entièrement en
 * absence reste vide et compte dans le nombre de jours d'absence. Les jours d'une
 * semaine qui tombent dans un autre mois restent vides (ils sont sur l'autre fiche).
 */
export function buildSheet(input: SheetInput): SheetModel {
  const first = utcDate(input.year, input.month, 1);
  const last = utcDate(input.year, input.month + 1, 0);
  const inMonth = (d: Date) => d >= first && d <= last;
  const hoursOf = (d: Date) => input.days.find((x) => sameDay(x.date, d));

  let absenceDays = 0;
  const used: SheetBlock[] = mondaysOfMonth(input.year, input.month).map((monday) => ({
    used: true,
    rows: Array.from({ length: WEEKDAY_COUNT }, (_, i) => {
      const date = addDays(monday, i);
      if (!inMonth(date)) return emptyRow(i);
      const label = `${capitalize(dict.weekdays[i]!)} ${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}`;
      const h = hoursOf(date);
      const worked = h ? h.hours - h.absence : 0;
      if (h && h.absence > 0 && worked <= 0) absenceDays++;
      return worked > 0 ? { label, arrival: input.arrival, departure: input.departure } : { label, arrival: "", departure: "" };
    }),
  }));
  const blocks = [...used];
  while (blocks.length < SHEET_TEMPLATE.blocks) blocks.push({ used: false, rows: Array.from({ length: WEEKDAY_COUNT }, (_, i) => emptyRow(i)) });

  return {
    name: `${input.lastName.toLocaleUpperCase("fr")} ${input.firstName}`,
    kind: input.internship.kind,
    direction: input.internship.direction,
    department: input.internship.department,
    service: input.internship.service,
    from: formatFrDate(input.internship.startDate),
    to: formatFrDate(input.internship.endDate),
    blocks: blocks.slice(0, SHEET_TEMPLATE.blocks),
    absenceDays,
    observation: input.observation ?? "",
  };
}

/** Nombre de semaines utilisées, pour la note sous l'aperçu. */
export const usedBlocks = (m: SheetModel) => m.blocks.filter((b) => b.used).length;

/** `Fiche_presence_AAAA-MM_NOM.pdf` : nom en capitales, sans accent ni espace. */
export function sheetFileName(year: number, month: number, lastName: string): string {
  const name = lastName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Fiche_presence_${year}-${pad2(month)}_${name}.pdf`;
}

/** Étape en cours du circuit (0 = Fiche générée) ; 4 quand tout est fait. */
export function currentStep(status: AttendanceStatus): number {
  return { GENERATED: 1, SIGNED_BY_INTERN: 2, SIGNED_BY_SUPERVISOR: 3, SENT: 4 }[status];
}

/** Transitions du circuit (§9.7, §9.8). Renvoie null si l'action n'est pas permise. */
export function nextAttendanceStatus(
  status: AttendanceStatus,
  action: "INTERN_SIGN" | "SUPERVISOR_SIGN" | "SUPERVISOR_REJECT" | "SEND",
): AttendanceStatus | null {
  if (action === "INTERN_SIGN") return status === "GENERATED" ? "SIGNED_BY_INTERN" : null;
  if (action === "SUPERVISOR_SIGN") return status === "SIGNED_BY_INTERN" ? "SIGNED_BY_SUPERVISOR" : null;
  if (action === "SUPERVISOR_REJECT") return status === "SIGNED_BY_INTERN" ? "GENERATED" : null;
  return status === "SIGNED_BY_SUPERVISOR" ? "SENT" : null;
}

/** Mois en toutes lettres : « Février 2026 ». */
export const monthLabel = (year: number, month: number) => `${capitalize(dict.months[month - 1]!)} ${year}`;
