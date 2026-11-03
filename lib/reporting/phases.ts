// Jours par phase DMAIC (PROMPT.md §9.5) : chaque jour saisi sur un projet DMAIC
// compte dans la phase où était le projet ce jour-là. Pur : la couche de données
// fournit les jours et l'historique des phases.
import { DMAIC_PHASES, phaseOn, type PhaseChange } from "../projects/dmaic";

/** Projet DMAIC et ses entrées dans chaque phase, dans l'ordre. */
export type PhaseProject = { projectId: string; code: string; name: string; changes: PhaseChange[] };

export type PhaseRow = {
  projectId: string;
  code: string;
  name: string;
  /** Jours saisis avant que le projet devienne DMAIC. */
  before: number;
  /** Jours par phase, dans l'ordre Définir → Contrôler. */
  byPhase: number[];
  total: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Une ligne par projet DMAIC qui a des jours saisis, par code. */
export function daysByPhase(entries: ReadonlyArray<{ projectId: string; date: Date; hours: number }>, projects: readonly PhaseProject[]): PhaseRow[] {
  const rows = new Map<string, PhaseRow>(
    projects.map((p) => [p.projectId, { projectId: p.projectId, code: p.code, name: p.name, before: 0, byPhase: DMAIC_PHASES.map(() => 0), total: 0 }]),
  );
  const changesOf = new Map(projects.map((p) => [p.projectId, p.changes]));
  for (const e of entries) {
    const row = rows.get(e.projectId);
    if (!row) continue;
    const phase = phaseOn(changesOf.get(e.projectId)!, e.date);
    if (phase === null) row.before = round(row.before + e.hours);
    else {
      const i = DMAIC_PHASES.indexOf(phase);
      row.byPhase[i] = round(row.byPhase[i]! + e.hours);
    }
    row.total = round(row.total + e.hours);
  }
  return [...rows.values()].filter((r) => r.total > 0).sort((a, b) => a.code.localeCompare(b.code, "fr"));
}
