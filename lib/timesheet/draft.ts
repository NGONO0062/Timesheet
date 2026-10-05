// Contrôle d'un brouillon reçu du navigateur (PROMPT.md §9.2 et §9.4). Pur : la
// couche de données fournit l'existant et les lignes autorisées, puis écrit le plan.
import { isMultipleOf } from "./rules";

const MAX_HOURS_PER_CELL = 24;

/** Une valeur par jour ouvré ; null pour une cellule laissée vide (un « 0 » saisi est gardé). */
export type DraftLineInput = { projectId: string; activityId: string; hours: Array<number | null> };

export type ExistingLine = {
  projectId: string;
  activityId: string;
  hours: Array<number | null>;
  flagged: boolean[];
  /** Le projet est « En cours » : la ligne accepte encore des heures. */
  open: boolean;
};

export type PlannedLine = {
  projectId: string;
  activityId: string;
  position: number;
  /** Une entrée par jour saisi (index du jour ouvré) ; les cellules laissées vides ne sont pas stockées. */
  entries: Array<{ day: number; hours: number; flagged: boolean }>;
};

export type DraftError = "lineNotAllowed" | "invalidHours";

export const lineKey = (l: { projectId: string; activityId: string }) => `${l.projectId}:${l.activityId}`;

export function planDraft(input: {
  lines: DraftLineInput[];
  existing: ExistingLine[];
  /** Lignes qu'on peut ajouter : projet dont on est membre, « En cours », qui couvre la semaine. */
  eligible: ReadonlySet<string>;
  step: number;
  dayCount: number;
}): { ok: true; lines: PlannedLine[] } | { ok: false; error: DraftError } {
  const existing = new Map(input.existing.map((l) => [lineKey(l), l]));
  const seen = new Set<string>();
  const planned: PlannedLine[] = [];

  for (const [position, line] of input.lines.entries()) {
    const key = lineKey(line);
    if (seen.has(key)) return { ok: false, error: "lineNotAllowed" };
    seen.add(key);

    const before = existing.get(key);
    if (!before && !input.eligible.has(key)) return { ok: false, error: "lineNotAllowed" };
    if (line.hours.length !== input.dayCount) return { ok: false, error: "invalidHours" };

    // Projet sorti de « En cours » : la ligne reste telle quelle, en lecture seule.
    if (before && !before.open) {
      planned.push({ projectId: line.projectId, activityId: line.activityId, position, entries: entriesOf(before.hours, before.flagged) });
      continue;
    }
    if (!line.hours.every((h) => h === null || (Number.isFinite(h) && h >= 0 && h <= MAX_HOURS_PER_CELL && isMultipleOf(h, input.step)))) {
      return { ok: false, error: "invalidHours" };
    }
    // Une cellule signalée le reste tant que sa valeur n'a pas changé.
    const flagged = line.hours.map((h, day) => Boolean(before?.flagged[day]) && before?.hours[day] === h);
    planned.push({ projectId: line.projectId, activityId: line.activityId, position, entries: entriesOf(line.hours, flagged) });
  }
  return { ok: true, lines: planned };
}

function entriesOf(hours: Array<number | null>, flagged: boolean[]) {
  return hours.flatMap((h, day) => (h !== null || flagged[day] ? [{ day, hours: h ?? 0, flagged: Boolean(flagged[day]) }] : []));
}

/** Totaux par jour d'un plan. */
export function planTotals(lines: PlannedLine[], dayCount: number): number[] {
  const totals = Array.from({ length: dayCount }, () => 0);
  for (const l of lines) for (const e of l.entries) totals[e.day] = Math.round(((totals[e.day] ?? 0) + e.hours) * 100) / 100;
  return totals;
}
