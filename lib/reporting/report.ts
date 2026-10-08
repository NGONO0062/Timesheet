// Reporting (PROMPT.md §9.5) et règles des graphiques (§4.3, point 6). Pur : la
// couche de données fournit les heures et les fiches, l'écran et les exports
// affichent le résultat.
import { NBSP, formatNumber } from "../format";
import { dict, t } from "../i18n";
import { compareWeeks, type IsoWeek } from "../iso-week";
import { displayStatus, type StoredStatus } from "../timesheet/rules";

export type Axis = "project" | "person" | "activity";
export const AXES: Axis[] = ["project", "person", "activity"];

/** Classes des quatre couleurs de séries, dans l'ordre fixe du §4.3. */
export const SERIES = ["chart-s1", "chart-s2", "chart-s3", "chart-s4"] as const;
export type SeriesClass = (typeof SERIES)[number];
export const OTHERS_KEY = "__autres__";

export type ReportEntry = {
  week: IsoWeek;
  personId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  activityName: string;
  hours: number;
};

export type ReportPerson = { id: string; name: string; team: string | null };
export type SheetState = { personId: string; week: IsoWeek; stored: StoredStatus | null; deadline: Date };

export type Entity = { key: string; label: string; sub: string; count: number; byWeek: number[]; total: number };
export type Series = { key: string; label: string; cls: SeriesClass; keys: string[] };

/**
 * Couleurs de séries : la couleur suit l'entité, pas son rang dans l'affichage.
 * Elle est attribuée sur l'ensemble du périmètre (toute l'équipe), par heures
 * décroissantes : un filtre ne repeint pas les séries restantes. Au-delà de
 * quatre entités, les trois premières gardent leur couleur et le reste forme « Autres ».
 */
export function assignSeries(entities: Array<{ key: string; label: string; total: number }>): Series[] {
  const sorted = [...entities].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr"));
  if (sorted.length <= SERIES.length) return sorted.map((e, i) => ({ key: e.key, label: e.label, cls: SERIES[i]!, keys: [e.key] }));
  const head = sorted.slice(0, SERIES.length - 1).map((e, i) => ({ key: e.key, label: e.label, cls: SERIES[i]!, keys: [e.key] }));
  return [...head, { key: OTHERS_KEY, label: dict.reporting.others, cls: SERIES[SERIES.length - 1]!, keys: sorted.slice(SERIES.length - 1).map((e) => e.key) }];
}

const keyOf = (axis: Axis, e: ReportEntry) => (axis === "project" ? e.projectId : axis === "person" ? e.personId : e.activityName);

/** Regroupe les heures par entité de l'axe, semaine par semaine. */
export function groupEntities(axis: Axis, entries: ReportEntry[], weeks: IsoWeek[], people: ReportPerson[], members: Map<string, number>): Entity[] {
  const map = new Map<string, Entity>();
  const index = (w: IsoWeek) => weeks.findIndex((x) => compareWeeks(x, w) === 0);
  const projectsOf = new Map<string, Set<string>>();
  for (const e of entries) {
    const j = index(e.week);
    if (j < 0) continue;
    const key = keyOf(axis, e);
    let entity = map.get(key);
    if (!entity) {
      const person = people.find((p) => p.id === e.personId);
      entity = {
        key,
        label: axis === "project" ? e.projectName : axis === "person" ? (person?.name ?? "") : e.activityName,
        sub: axis === "project" ? e.projectCode : axis === "person" ? (person?.team ?? "") : "",
        count: axis === "project" ? (members.get(e.projectId) ?? 0) : 0,
        byWeek: weeks.map(() => 0),
        total: 0,
      };
      map.set(key, entity);
    }
    entity.byWeek[j] = round(entity.byWeek[j]! + e.hours);
    entity.total = round(entity.total + e.hours);
    if (axis === "activity") {
      const set = projectsOf.get(key) ?? new Set<string>();
      set.add(e.projectId);
      projectsOf.set(key, set);
      entity.count = set.size;
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "fr"));
}

const round = (n: number) => Math.round(n * 100) / 100;

export type Kpis = {
  entered: number;
  capacity: number;
  persons: number;
  weeks: number;
  missingHours: number;
  missingSheets: number;
  validated: number;
  pending: number;
  expectedSheets: number;
};

/** Indicateurs : heures saisies sur la capacité, taux de remplissage, fiches validées sur le total attendu. */
export function computeKpis(input: { entries: ReportEntry[]; sheets: SheetState[]; persons: number; weekCapacity: number[]; now: Date }): Kpis {
  const entered = round(input.entries.reduce((a, e) => a + e.hours, 0));
  const capacity = round(input.persons * input.weekCapacity.reduce((a, b) => a + b, 0));
  const statuses = input.sheets.map((s) => displayStatus(s.stored, s.deadline, input.now));
  return {
    entered,
    capacity,
    persons: input.persons,
    weeks: input.weekCapacity.length,
    missingHours: Math.max(0, round(capacity - entered)),
    missingSheets: statuses.filter((s) => s === "MISSING").length,
    validated: statuses.filter((s) => s === "VALIDATED").length,
    pending: statuses.filter((s) => s === "SUBMITTED").length,
    expectedSheets: input.sheets.length,
  };
}

/** Part d'un total, une décimale : « 41,9 % », « 21,0 % » ; le total s'écrit « 100 % ». */
export function formatShare(part: number, total: number): string {
  if (total <= 0) return `0${NBSP}%`;
  const value = Math.round((part * 1000) / total) / 10;
  return `${value === 100 ? "100" : value.toFixed(1).replace(".", ",")}${NBSP}%`;
}

/** Textes des trois indicateurs (planche 10). */
export function kpiTexts(k: Kpis) {
  const r = dict.reporting;
  const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });
  const fill = k.capacity > 0 ? Math.round((k.entered * 100) / k.capacity) : 0;
  const missingParts = [
    k.missingHours > 0 ? t(r.notEntered, { hours: `${formatNumber(k.missingHours)}${NBSP}h` }) : r.nothingMissing,
    ...(k.missingSheets > 0 ? [plural(k.missingSheets, r.missingSheetsOne, r.missingSheetsMany)] : []),
  ];
  return {
    capacity: t(r.capacityOf, {
      capacity: `${formatNumber(k.capacity)}${NBSP}h`,
      persons: plural(k.persons, r.personsOne, r.personsMany),
      weeks: plural(k.weeks, r.weeksOne, r.weeksMany),
    }),
    fill: `${fill}${NBSP}%`,
    fillDetail: missingParts.join(" : "),
    validated: t(r.validatedOf, { n: k.validated, total: k.expectedSheets }),
    validatedDetail: [plural(k.pending, r.pendingOne, r.pendingMany), plural(k.missingSheets, r.missingOne, r.missingMany)].join(", "),
  };
}
