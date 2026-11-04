// Revues de passage d'un projet DMAIC (PROMPT.md §9.4, lot 3). Qui gère le projet
// demande la revue de la phase en cours ; le sponsor accorde le passage (le projet
// entre dans la phase suivante) ou demande des compléments. Sans sponsor, la phase
// se change directement, comme au lot 1. Pur.
import { DMAIC_PHASES, nextPhase, type DmaicPhase } from "./dmaic";

export type TollgateStatus = "REQUESTED" | "APPROVED" | "CHANGES_REQUESTED";
export type TollgateRecord = { phase: DmaicPhase; status: TollgateStatus; requestedAt: Date };

/** Dernière revue d'une phase (la plus récente demande), ou null. */
export function latestTollgate<T extends TollgateRecord>(tollgates: readonly T[], phase: DmaicPhase): T | null {
  let latest: T | null = null;
  for (const g of tollgates) if (g.phase === phase && (latest === null || g.requestedAt.getTime() >= latest.requestedAt.getTime())) latest = g;
  return latest;
}

/** Passage accordé pour cette phase (dernière revue « accordée »). */
export function phasePassed(tollgates: readonly TollgateRecord[], phase: DmaicPhase): boolean {
  return latestTollgate(tollgates, phase)?.status === "APPROVED";
}

/**
 * Peut-on passer directement de `from` à `to` (panneau du projet, « Annuler ») ?
 * Toujours pour revenir en arrière ou sans sponsor. Avec un sponsor, en avant
 * seulement si chaque phase quittée a son passage accordé.
 */
export function canMoveDirectly(hasSponsor: boolean, tollgates: readonly TollgateRecord[], from: DmaicPhase, to: DmaicPhase): boolean {
  const a = DMAIC_PHASES.indexOf(from);
  const b = DMAIC_PHASES.indexOf(to);
  if (b <= a || !hasSponsor) return true;
  return DMAIC_PHASES.slice(a, b).every((ph) => phasePassed(tollgates, ph));
}

export type TollgateRefusal = "noSponsor" | "alreadyRequested" | "alreadyApproved";

/** Demande de revue de la phase en cours : il faut un sponsor, et aucune revue en attente ni accordée. */
export function requestRefusal(hasSponsor: boolean, tollgates: readonly TollgateRecord[], phase: DmaicPhase): TollgateRefusal | null {
  if (!hasSponsor) return "noSponsor";
  const latest = latestTollgate(tollgates, phase);
  if (latest?.status === "REQUESTED") return "alreadyRequested";
  if (latest?.status === "APPROVED") return "alreadyApproved";
  return null;
}

/** Phase où entre le projet quand le passage est accordé ; null après « Contrôler » (démarche close). */
export function phaseAfterApproval(phase: DmaicPhase): DmaicPhase | null {
  return nextPhase(phase);
}

/** Compléments demandés : un commentaire est obligatoire. */
export function checkDecision(decision: "APPROVE" | "CHANGES", comment: string): { ok: true; comment: string | null } | { ok: false } {
  const c = comment.trim();
  if (decision === "CHANGES" && !c) return { ok: false };
  return { ok: true, comment: c ? c.slice(0, 2000) : null };
}
