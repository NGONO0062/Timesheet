// Modèle de l'écran Reporting (planche 10), partagé par la page et les exports.
// Pur : il ne fait que mettre en forme les données de la couche d'accès.
import { formatFromTo, formatHours, formatRange } from "../format";
import { dict, t } from "../i18n";
import { addDays, compareWeeks, isValidIsoWeek, mondayOf, shiftWeek, type IsoWeek } from "../iso-week";
import {
  AXES, assignSeries, computeKpis, formatShare, groupEntities, kpiTexts, OTHERS_KEY, type Axis, type ReportEntry, type ReportPerson,
  type SeriesClass, type SheetState,
} from "./report";

const r = dict.reporting;
export const WEEK_CHOICES = 12;
const COLUMN_HEIGHT = 160;

export type ReportParams = { axis: Axis; from: IsoWeek; to: IsoWeek; personId: string | null };

const parseWeekKey = (raw: string | undefined): IsoWeek | null => {
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw ?? "");
  if (!m) return null;
  const w = { year: Number(m[1]), week: Number(m[2]) };
  return isValidIsoWeek(w) ? w : null;
};
export const weekKey = (w: IsoWeek) => `${w.year}-${w.week}`;

/** Paramètres de l'adresse : axe, semaines de début et de fin, personne. Par défaut, les trois dernières semaines. */
export function parseReportParams(sp: { axe?: string; de?: string; a?: string; personne?: string }, current: IsoWeek): ReportParams {
  const axis = (AXES as string[]).includes(sp.axe ?? "") ? (sp.axe as Axis) : "project";
  let from = parseWeekKey(sp.de) ?? shiftWeek(current, -2);
  let to = parseWeekKey(sp.a) ?? current;
  if (compareWeeks(from, to) > 0) [from, to] = [to, from];
  return { axis, from, to, personId: sp.personne || null };
}

/** Semaines proposées dans les listes « De la semaine » et « À la semaine ». */
export function weekChoices(current: IsoWeek): Array<{ key: string; label: string }> {
  return Array.from({ length: WEEK_CHOICES }, (_, i) => shiftWeek(current, -i)).map((w) => ({
    key: weekKey(w),
    label: t(r.weekOption, { week: w.week, range: formatRange(mondayOf(w), addDays(mondayOf(w), 4)) }),
  }));
}

export function weeksBetween(from: IsoWeek, to: IsoWeek): IsoWeek[] {
  const out: IsoWeek[] = [];
  for (let w = from; compareWeeks(w, to) <= 0 && out.length < 60; w = shiftWeek(w, 1)) out.push(w);
  return out;
}

export type ReportView = ReturnType<typeof buildReportView>;

export function buildReportView(input: {
  params: ReportParams;
  current: IsoWeek;
  people: ReportPerson[];
  entries: ReportEntry[];
  states: SheetState[];
  members: Map<string, number>;
  weekCapacity: number[];
  now: Date;
}) {
  const { params, current } = input;
  const weeks = weeksBetween(params.from, params.to);
  const person = params.personId ? input.people.find((p) => p.id === params.personId) ?? null : null;
  const selectedPeople = person ? [person] : input.people;
  const entries = person ? input.entries.filter((e) => e.personId === person.id) : input.entries;
  const states = person ? input.states.filter((s) => s.personId === person.id) : input.states;

  // Couleurs : attribuées sur toute l'équipe, pour qu'un filtre ne les change pas.
  const series = assignSeries(groupEntities(params.axis, input.entries, weeks, input.people, input.members));
  const seriesOf = (key: string) => series.find((s) => s.keys.includes(key)) ?? series.find((s) => s.key === OTHERS_KEY)!;
  const entities = groupEntities(params.axis, entries, weeks, input.people, input.members);

  const kpis = computeKpis({ entries, sheets: states, persons: selectedPeople.length, weekCapacity: input.weekCapacity, now: input.now });
  const texts = kpiTexts(kpis);
  const period = formatFromTo(mondayOf(params.from), addDays(mondayOf(params.to), 4));
  const periodLower = period.charAt(0).toLowerCase() + period.slice(1);

  // Une valeur par série (« Autres » regroupe le reste).
  const perSeries = series
    .map((s) => {
      const members = entities.filter((e) => s.keys.includes(e.key));
      return { key: s.key, label: s.label, cls: s.cls, total: round(members.reduce((a, e) => a + e.total, 0)), byWeek: weeks.map((_, j) => round(members.reduce((a, e) => a + e.byWeek[j]!, 0))) };
    })
    .filter((s) => s.total > 0);
  const maxBar = Math.max(1, ...perSeries.map((s) => s.total));
  const weekTotals = weeks.map((_, j) => round(entities.reduce((a, e) => a + e.byWeek[j]!, 0)));
  const maxCol = Math.max(1, ...weekTotals);
  const grand = round(weekTotals.reduce((a, b) => a + b, 0));

  return {
    params,
    weeks,
    period,
    periodLower,
    empty: grand === 0,
    kpis,
    texts,
    bars: perSeries.map((s) => ({
      key: s.key,
      label: s.label,
      cls: s.cls as SeriesClass,
      value: s.total,
      valueText: formatHours(s.total),
      width: Math.round((s.total * 100) / maxBar),
    })),
    barsAria: t(r.barsAria, { items: perSeries.map((s) => t(r.hoursOf, { label: s.label, hours: formatHours(s.total) })).join(", ") }),
    columns: weeks.map((w, j) => ({
      key: weekKey(w),
      label: compareWeeks(w, current) >= 0 ? t(r.weekOpen, { week: w.week }) : t(r.weekLabel, { week: w.week }),
      open: compareWeeks(w, current) >= 0,
      total: weekTotals[j]!,
      totalText: formatHours(weekTotals[j]!),
      height: Math.round((weekTotals[j]! * COLUMN_HEIGHT) / maxCol),
      // De bas en haut : la première série en bas de la pile.
      segments: perSeries
        .filter((s) => s.byWeek[j]! > 0)
        .map((s) => ({ key: s.key, cls: s.cls as SeriesClass, value: s.byWeek[j]!, title: t(r.segment, { label: s.label, week: w.week, hours: formatHours(s.byWeek[j]!) }) }))
        .reverse(),
    })),
    columnsAria: t(r.columnsAria, {
      items: weeks.map((w, j) => `${t(r.weekLabel, { week: w.week })}, ${formatHours(weekTotals[j]!)}`).join(" ; "),
    }),
    legend: perSeries.map((s) => ({ key: s.key, label: s.label, cls: s.cls as SeriesClass })),
    capacityNote: t(r.capacityNote, { hours: formatHours(round(selectedPeople.length * (input.weekCapacity[0] ?? 0))) }),
    table: {
      head: weeks.map((w) => t(r.weekLabel, { week: w.week })),
      rows: entities.map((e) => ({
        key: e.key,
        label: e.label,
        sub: e.sub,
        count: e.count,
        cells: e.byWeek.map((h) => formatHours(h)),
        total: formatHours(e.total),
        share: formatShare(e.total, grand),
        series: seriesOf(e.key).cls as SeriesClass,
        raw: { byWeek: e.byWeek, total: e.total, share: grand > 0 ? e.total / grand : 0 },
      })),
      foot: { cells: weekTotals.map((h) => formatHours(h)), total: formatHours(grand), share: formatShare(grand, grand), raw: { byWeek: weekTotals, total: grand } },
    },
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Adresse du rapport (filtres), reprise par les liens d'export. */
export function reportQuery(p: ReportParams): string {
  const q = new URLSearchParams();
  if (p.axis !== "project") q.set("axe", p.axis);
  q.set("de", weekKey(p.from));
  q.set("a", weekKey(p.to));
  if (p.personId) q.set("personne", p.personId);
  return q.toString();
}
