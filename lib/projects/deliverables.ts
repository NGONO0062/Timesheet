// Livrables types d'un projet DMAIC (PROMPT.md §9.4, lot 3) : trois par phase, dans
// l'ordre de la démarche. Catalogue fixe ; seuls les livrables faits sont enregistrés.
import { dict } from "../i18n";
import { DMAIC_PHASES, type DmaicPhase } from "./dmaic";

export const DELIVERABLES = {
  DEFINE: ["DEFINE_CHARTER", "DEFINE_SIPOC", "DEFINE_VOC"],
  MEASURE: ["MEASURE_PLAN", "MEASURE_MSA", "MEASURE_BASELINE"],
  ANALYZE: ["ANALYZE_CAUSES", "ANALYZE_ROOT", "ANALYZE_OPPORTUNITY"],
  IMPROVE: ["IMPROVE_SOLUTIONS", "IMPROVE_PILOT", "IMPROVE_PLAN"],
  CONTROL: ["CONTROL_PLAN", "CONTROL_STANDARD", "CONTROL_HANDOVER"],
} as const satisfies Record<DmaicPhase, readonly string[]>;

export type DeliverableKey = (typeof DELIVERABLES)[DmaicPhase][number];

export const DELIVERABLE_KEYS: DeliverableKey[] = DMAIC_PHASES.flatMap((ph) => [...DELIVERABLES[ph]]);

export function isDeliverableKey(s: unknown): s is DeliverableKey {
  return typeof s === "string" && (DELIVERABLE_KEYS as string[]).includes(s);
}

export function deliverableLabel(key: DeliverableKey): string {
  return dict.dmaic.deliverables[key];
}

/** Livrables faits d'une phase, sur le total de la phase. */
export function deliverableProgress(phase: DmaicPhase, done: ReadonlySet<string>): { done: number; total: number } {
  const keys = DELIVERABLES[phase];
  return { done: keys.filter((k) => done.has(k)).length, total: keys.length };
}
