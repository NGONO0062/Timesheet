// Projets DMAIC (PROMPT.md §9.4) : cinq phases, dans l'ordre. Pures : la couche de
// données les applique côté serveur, l'interface les affiche.
import { dict, t } from "../i18n";

export type ProjectKind = "STANDARD" | "DMAIC";
export type DmaicPhase = "DEFINE" | "MEASURE" | "ANALYZE" | "IMPROVE" | "CONTROL";

export const PROJECT_KINDS: ProjectKind[] = ["STANDARD", "DMAIC"];
export const DMAIC_PHASES: DmaicPhase[] = ["DEFINE", "MEASURE", "ANALYZE", "IMPROVE", "CONTROL"];

export function isDmaicPhase(s: unknown): s is DmaicPhase {
  return typeof s === "string" && (DMAIC_PHASES as string[]).includes(s);
}

export function phaseLabel(phase: DmaicPhase): string {
  return dict.project.phases[phase];
}

/** Rang de la phase, de 1 (Définir) à 5 (Contrôler). */
export function phaseNumber(phase: DmaicPhase): number {
  return DMAIC_PHASES.indexOf(phase) + 1;
}

export function nextPhase(phase: DmaicPhase): DmaicPhase | null {
  return DMAIC_PHASES[DMAIC_PHASES.indexOf(phase) + 1] ?? null;
}

export function previousPhase(phase: DmaicPhase): DmaicPhase | null {
  const i = DMAIC_PHASES.indexOf(phase);
  return DMAIC_PHASES[i - 1] ?? null;
}

/** « DMAIC · Analyser (3 sur 5) » sous le code du projet ; null pour un projet standard. */
export function phaseLine(kind: ProjectKind, phase: DmaicPhase | null): string | null {
  if (kind !== "DMAIC" || phase === null) return null;
  return t(dict.project.phaseLine, { n: phaseNumber(phase), total: DMAIC_PHASES.length, phase: phaseLabel(phase) });
}

/** « Phase 3 sur 5 : Analyser », écrit sous les étapes. */
export function phaseStepText(phase: DmaicPhase): string {
  return t(dict.project.phaseStepOf, { n: phaseNumber(phase), total: DMAIC_PHASES.length, phase: phaseLabel(phase) });
}

/** Message après un changement de phase, avec « Annuler ». */
export function phaseChangedMessage(name: string, phase: DmaicPhase): string {
  return t(dict.project.phaseChanged, { name, phase: phaseLabel(phase) });
}

/**
 * Phase d'un projet quand son type change : un projet qui devient DMAIC commence
 * par « Définir » ; un projet qui reste DMAIC garde sa phase ; un projet standard
 * n'en a pas. Renvoie aussi la phase à inscrire dans l'historique (entrée dans une phase).
 */
export function phaseAfterKindChange(
  before: { kind: ProjectKind; phase: DmaicPhase | null } | null,
  kind: ProjectKind,
): { phase: DmaicPhase | null; entered: DmaicPhase | null } {
  if (kind === "STANDARD") return { phase: null, entered: null };
  if (before?.kind === "DMAIC" && before.phase !== null) return { phase: before.phase, entered: null };
  return { phase: "DEFINE", entered: "DEFINE" };
}
