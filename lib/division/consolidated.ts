// Vue consolidée de la division (PROMPT.md §9.6, planche 11-Vue-consolidee). Pur :
// la couche de données fournit équipes, heures et fiches ; l'écran affiche le résultat.
import { NBSP, formatHours, formatNumber } from "../format";
import { dict, t } from "../i18n";
import { compareWeeks, type IsoWeek } from "../iso-week";
import { displayStatus, type StoredStatus } from "../timesheet/rules";

const d = dict.division;
export const TREND_WEEKS = 6;
const TREND_HEIGHT = 160;

const round = (n: number) => Math.round(n * 100) / 100;
const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });
export const pct = (n: number) => `${n}${NBSP}%`;

/** Taux de remplissage en pour cent entier ; 0 sans capacité. */
export function fillRate(entered: number, capacity: number): number {
  return capacity > 0 ? Math.round((entered * 100) / capacity) : 0;
}

export type TeamInfo = { id: string; name: string; manager: string | null; managerId: string | null };
export type Member = { id: string; name: string; teamId: string | null; managerId: string | null; manager: string | null };
/** État d'une fiche d'une personne pour une semaine : heures saisies (brouillon compris) et statut enregistré. */
export type PersonWeek = { personId: string; week: IsoWeek; hours: number; stored: StoredStatus | null; deadline: Date };

export type TeamRow = {
  id: string;
  name: string;
  manager: string | null;
  persons: number;
  entered: number;
  capacity: number;
  fill: number;
  submitted: number;
  validated: number;
  under: boolean;
};

const sameWeek = (a: IsoWeek, b: IsoWeek) => compareWeeks(a, b) === 0;
const isSubmitted = (s: StoredStatus | null) => s === "SUBMITTED" || s === "VALIDATED";

function rowOf(id: string, name: string, manager: string | null, people: Member[], states: PersonWeek[], weekCapacity: number, threshold: number): TeamRow {
  const own = states.filter((s) => people.some((p) => p.id === s.personId));
  const entered = round(own.reduce((a, s) => a + s.hours, 0));
  const capacity = round(people.length * weekCapacity);
  const fill = fillRate(entered, capacity);
  return {
    id,
    name,
    manager,
    persons: people.length,
    entered,
    capacity,
    fill,
    submitted: own.filter((s) => isSubmitted(s.stored)).length,
    validated: own.filter((s) => s.stored === "VALIDATED").length,
    under: people.length > 0 && fill < threshold,
  };
}

/**
 * Tableau par équipe pour une semaine, et ligne Division. Une personne sans équipe
 * compte dans la ligne Division et dans une ligne « Sans équipe ».
 */
export function teamTable(input: { teams: TeamInfo[]; people: Member[]; states: PersonWeek[]; week: IsoWeek; weekCapacity: number; threshold: number }) {
  const states = input.states.filter((s) => sameWeek(s.week, input.week));
  const rows = input.teams
    .map((team) => rowOf(team.id, team.name, team.manager, input.people.filter((p) => p.teamId === team.id), states, input.weekCapacity, input.threshold))
    .filter((r) => r.persons > 0)
    // Les équipes les plus nombreuses d'abord (planche 11 : Parcours, Études, Data CX).
    .sort((a, b) => b.persons - a.persons || a.name.localeCompare(b.name, "fr"));
  const loose = input.people.filter((p) => p.teamId === null || !input.teams.some((team) => team.id === p.teamId));
  if (loose.length > 0) rows.push(rowOf(NO_TEAM, d.noTeam, null, loose, states, input.weekCapacity, input.threshold));
  const total = rowOf("division", d.divisionRow, null, input.people, states, input.weekCapacity, input.threshold);
  return { rows, total };
}
export const NO_TEAM = "sans-equipe";

/** Remplissage d'une ligne du tableau : « 83 % · 200 / 240 h ». */
export const fillText = (r: TeamRow) => t(d.teamFill, { pct: pct(r.fill), entered: formatNumber(r.entered), capacity: formatHours(r.capacity) });

/** Indicateurs de la semaine (planche 11) : remplissage, fiches soumises, fiches validées. */
export function kpiTexts(total: TeamRow) {
  const notSubmitted = total.persons - total.submitted;
  const pending = total.submitted - total.validated;
  return {
    fill: pct(total.fill),
    fillDetail: t(d.fillDetail, { entered: formatHours(total.entered), capacity: formatHours(total.capacity) }),
    submitted: t(d.of, { n: total.submitted, total: total.persons }),
    submittedDetail: total.submitted === 0 ? d.noSheetTitle : notSubmitted === 0 ? d.allSubmitted : plural(notSubmitted, d.notSubmittedOne, d.notSubmittedMany),
    validated: t(d.of, { n: total.validated, total: total.persons }),
    validatedDetail: pending === 0 ? d.nonePending : t(d.pendingAtManagers, { n: pending }),
  };
}

/** Tendance : taux de remplissage des six semaines qui finissent à `week`, colonne évidée pour la semaine en cours. */
export function trend(input: { weeks: IsoWeek[]; states: PersonWeek[]; persons: number; weekCapacity: number[]; current: IsoWeek }) {
  return input.weeks.map((w, i) => {
    const entered = input.states.filter((s) => sameWeek(s.week, w)).reduce((a, s) => a + s.hours, 0);
    const fill = fillRate(entered, input.persons * (input.weekCapacity[i] ?? 0));
    const open = compareWeeks(w, input.current) >= 0;
    return {
      key: `${w.year}-${w.week}`,
      label: t(d.trendWeek, { week: w.week }),
      open,
      fill,
      valueText: pct(fill),
      height: Math.round((Math.min(fill, 100) * TREND_HEIGHT) / 100),
      title: t(open ? d.trendMarkOpen : d.trendMark, { week: w.week, pct: pct(fill) }),
    };
  });
}

// --- Dérives ------------------------------------------------------------------

export type DriftKind = "BUDGET" | "UNDERFILL" | "LATE_VALIDATION" | "MISSING";
export type Drift =
  | { kind: "BUDGET"; key: string; projectId: string; project: string; consumed: number; budget: number; owner: string | null }
  | { kind: "UNDERFILL"; key: string; teamId: string; team: string; week: IsoWeek; fill: number; threshold: number; owner: string | null }
  | { kind: "LATE_VALIDATION"; key: string; managerId: string; team: string; count: number; days: number; owner: string | null }
  | { kind: "MISSING"; key: string; personId: string; person: string; week: IsoWeek; missing: number; owner: string | null };

const ORDER: DriftKind[] = ["BUDGET", "UNDERFILL", "LATE_VALIDATION", "MISSING"];

/** Projets dont les heures consommées (fiches soumises ou validées) dépassent le budget. */
export function budgetDrifts(projects: Array<{ id: string; name: string; consumed: number; budget: number | null; owner: string | null }>): Drift[] {
  return projects
    .filter((p) => p.budget !== null && p.consumed > p.budget)
    .sort((a, b) => b.consumed - b.budget! - (a.consumed - a.budget!) || a.name.localeCompare(b.name, "fr"))
    .map((p) => ({ kind: "BUDGET", key: `budget-${p.id}`, projectId: p.id, project: p.name, consumed: round(p.consumed), budget: p.budget!, owner: p.owner }));
}

/** Équipes sous le seuil de remplissage de la division pour la semaine. */
export function underfillDrifts(rows: TeamRow[], week: IsoWeek, threshold: number): Drift[] {
  return rows
    .filter((r) => r.under && r.id !== NO_TEAM)
    .map((r) => ({ kind: "UNDERFILL", key: `remplissage-${r.id}`, teamId: r.id, team: r.name, week, fill: r.fill, threshold, owner: r.manager }));
}

/**
 * Fiches soumises en attente depuis plus de N jours ouvrés, regroupées par validateur.
 * `late` dit pour chaque fiche si le délai est dépassé (règle de lib/timesheet/workdays).
 */
export function lateDrifts(sheets: Array<{ managerId: string; manager: string; team: string; late: boolean }>, days: number): Drift[] {
  const byManager = new Map<string, { manager: string; team: string; count: number }>();
  for (const s of sheets) {
    if (!s.late) continue;
    const g = byManager.get(s.managerId) ?? { manager: s.manager, team: s.team, count: 0 };
    g.count++;
    byManager.set(s.managerId, g);
  }
  return [...byManager.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.team.localeCompare(b.team, "fr"))
    .map(([managerId, g]) => ({ kind: "LATE_VALIDATION", key: `retard-${managerId}`, managerId, team: g.team, count: g.count, days, owner: g.manager }));
}

/** Semaines dont l'échéance est passée sans soumission : heures attendues non saisies. */
export function missingDrifts(input: { people: Member[]; states: PersonWeek[]; weeks: IsoWeek[]; expected: number[]; now: Date; deadlines: Date[] }): Drift[] {
  const out: Array<Extract<Drift, { kind: "MISSING" }>> = [];
  input.weeks.forEach((w, i) => {
    for (const p of input.people) {
      const s = input.states.find((x) => x.personId === p.id && sameWeek(x.week, w));
      if (displayStatus(s?.stored ?? null, input.deadlines[i]!, input.now) !== "MISSING") continue;
      const missing = round(Math.max(0, (input.expected[i] ?? 0) - (s?.hours ?? 0)));
      out.push({ kind: "MISSING", key: `saisie-${p.id}-${w.year}-${w.week}`, personId: p.id, person: p.name, week: w, missing, owner: p.manager });
    }
  });
  // Les semaines les plus récentes d'abord.
  return out.sort((a, b) => compareWeeks(b.week, a.week) || a.person.localeCompare(b.person, "fr"));
}

/** Toutes les dérives, dans l'ordre de la planche : budget, remplissage, validation, saisie. */
export function sortDrifts(drifts: Drift[]): Drift[] {
  return [...drifts].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

export type DriftAction = { kind: "link"; href: string; label: string } | { kind: "remindManager" | "remindPerson"; label: string };

/** Textes d'une ligne du tableau des dérives : type, objet, écart, responsable, action. */
export function driftRow(drift: Drift): { tone: "danger" | "warning"; type: string; object: string; gap: string; owner: string; action: DriftAction } {
  const type = d.type[drift.kind];
  const owner = drift.owner ?? "";
  switch (drift.kind) {
    case "BUDGET":
      return {
        tone: "danger",
        type,
        object: drift.project,
        gap: t(d.budgetGap, { consumed: formatHours(drift.consumed), budget: formatHours(drift.budget), over: formatHours(round(drift.consumed - drift.budget)) }),
        owner,
        action: { kind: "link", href: `/projets?projet=${encodeURIComponent(drift.projectId)}`, label: d.seeProject },
      };
    case "UNDERFILL":
      return {
        tone: "danger",
        type,
        object: t(d.underfillObject, { name: drift.team, week: drift.week.week }),
        gap: t(d.underfillGap, { pct: pct(drift.fill), threshold: pct(drift.threshold) }),
        owner,
        action: { kind: "link", href: `#${teamAnchor(drift.teamId)}`, label: d.seeTeam },
      };
    case "LATE_VALIDATION":
      return {
        tone: "warning",
        type,
        object: t(d.lateObject, { name: drift.team }),
        gap: t(drift.count > 1 ? d.lateGapMany : d.lateGapOne, { n: drift.count, days: drift.days }),
        owner,
        action: { kind: "remindManager", label: d.remindManager },
      };
    case "MISSING":
      return {
        tone: "warning",
        type,
        object: t(d.missingObject, { name: drift.person, week: drift.week.week }),
        gap: t(d.missingGap, { hours: formatHours(drift.missing) }),
        owner,
        action: { kind: "remindPerson", label: d.remind },
      };
  }
}

export const teamAnchor = (teamId: string) => `equipe-${teamId}`;
