// Formats d'affichage (PROMPT.md §15) : virgule décimale, espace insécable
// avant « h » et « % », tiret demi-cadratin pour les intervalles, 24 h.
import { dict } from "./i18n";

export const NBSP = " ";
export const TIMEZONE = "Africa/Douala";

/** 4 → « 4 », 0.5 → « 0,5 », 3.25 → « 3,25 ». */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",").replace("-", "−");
}

/** 8 → « 8 h » avec espace insécable. */
export function formatHours(n: number): string {
  return `${formatNumber(n)}${NBSP}h`;
}

/** 0.83 → « 83 % » avec espace insécable. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}${NBSP}%`;
}

/** « 8 / 8 h » : total sur attendu. */
export function formatHoursOf(done: number, expected: number): string {
  return `${formatNumber(done)} / ${formatHours(expected)}`;
}

// Les dates métier (jours de saisie) sont des dates sans heure, manipulées en UTC.
function parts(d: Date) {
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), weekday: (d.getUTCDay() + 6) % 7 };
}

/** « 16 mars 2026 » */
export function formatDate(d: Date): string {
  const p = parts(d);
  return `${p.day} ${dict.months[p.month]} ${p.year}`;
}

/** « 16 mars » */
export function formatDayMonth(d: Date): string {
  const p = parts(d);
  return `${p.day} ${dict.months[p.month]}`;
}

/** « jeudi 19 » */
export function formatWeekdayDay(d: Date): string {
  const p = parts(d);
  return `${dict.weekdays[p.weekday]} ${p.day}`;
}

/**
 * Intervalle de dates :
 *   même mois  → « 16–20 mars 2026 »
 *   deux mois  → « 28 sept. – 2 oct. 2026 »
 *   deux années→ « 29 déc. 2025 – 2 janv. 2026 »
 * Avec `withYear: false` : « 16–20 mars », « 23–27 févr. ».
 */
export function formatRange(start: Date, end: Date, withYear = true): string {
  const a = parts(start);
  const b = parts(end);
  const year = withYear ? ` ${b.year}` : "";
  if (a.year === b.year && a.month === b.month) {
    const month = withYear ? dict.months[a.month] : dict.monthsShort[a.month];
    return `${a.day}–${b.day} ${month}${year}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${dict.monthsShort[a.month]} – ${b.day} ${dict.monthsShort[b.month]}${year}`;
  }
  return `${a.day} ${dict.monthsShort[a.month]} ${a.year} – ${b.day} ${dict.monthsShort[b.month]} ${b.year}`;
}

/** « vendredi 20 mars 2026 » */
export function formatLongDate(d: Date): string {
  return `${dict.weekdays[parts(d).weekday]} ${formatDate(d)}`;
}

/** « 6 avril 2026 », ou « 6 avril » sans l'année. */
export function formatDayMonthYear(d: Date, withYear = true): string {
  return withYear ? formatDate(d) : formatDayMonth(d);
}

/**
 * Période en toutes lettres, dans une phrase :
 *   même mois  → « Du 9 au 13 mars 2026 »
 *   deux mois  → « Du 27 février au 3 mars 2026 »
 *   deux années→ « Du 29 décembre 2025 au 2 janvier 2026 »
 */
export function formatFromTo(start: Date, end: Date): string {
  const a = parts(start);
  const b = parts(end);
  const from = a.year !== b.year ? formatDate(start) : a.month !== b.month ? formatDayMonth(start) : String(a.day);
  return `${dict.fromTo.from} ${from} ${dict.fromTo.to} ${formatDate(end)}`;
}

/** Instant affiché dans le fuseau de la division : « 20 mars 2026, 16:42 ». */
export function formatDateTime(instant: Date): string {
  const z = zoned(instant);
  return `${z.day} ${dict.months[z.month]} ${z.year}, ${z.time}`;
}

/** « 20 mars 2026 à 16:42 », dans le fuseau de la division. */
export function formatDateAt(instant: Date): string {
  const z = zoned(instant);
  return `${z.day} ${dict.months[z.month]} ${z.year} ${dict.at} ${z.time}`;
}

/** « lundi 23 mars 2026 à 09:15 », dans le fuseau de la division. */
export function formatLongDateAt(instant: Date): string {
  const z = zoned(instant);
  const weekday = dict.weekdays[(new Date(Date.UTC(z.year, z.month, z.day)).getUTCDay() + 6) % 7];
  return `${weekday} ${formatDateAt(instant)}`;
}

/** Jour calendaire d'un instant, dans le fuseau de la division (minuit UTC). */
export function zonedDay(instant: Date): Date {
  const z = zoned(instant);
  return new Date(Date.UTC(z.year, z.month, z.day));
}

/** Première lettre en capitale : « Jeudi 19 mars ». */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 10:42 » dans le fuseau de la division. */
export function formatTime(instant: Date, withSeconds = false): string {
  const z = zoned(instant);
  return withSeconds ? `${z.time}:${z.seconds}` : z.time;
}

function zoned(instant: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: string) => f.formatToParts(instant).find((x) => x.type === type)?.value ?? "";
  return {
    day: Number(get("day")),
    month: Number(get("month")) - 1,
    year: Number(get("year")),
    time: `${get("hour")}:${get("minute")}`,
    seconds: get("second"),
  };
}

/** Joint une liste à la française : « a, b et c ». */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${dict.and} ${items[items.length - 1]}`;
}

/**
 * Liste de jours groupés par mois : « jeudi 19 et vendredi 20 mars »,
 * « vendredi 27 février et lundi 2 mars ».
 */
export function formatDayList(days: Date[]): string {
  const items: string[] = [];
  days.forEach((d, i) => {
    const next = days[i + 1];
    const lastOfMonth = !next || next.getUTCMonth() !== d.getUTCMonth();
    items.push(lastOfMonth ? `${formatWeekdayDay(d)} ${dict.months[d.getUTCMonth()]}` : formatWeekdayDay(d));
  });
  return joinList(items);
}

/** « 06/04/2026 » → date (minuit UTC) ; null si la date n'existe pas. */
export function parseFrDate(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d : null;
}

/** Date (minuit UTC) → « 06/04/2026 ». */
export function formatFrDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
