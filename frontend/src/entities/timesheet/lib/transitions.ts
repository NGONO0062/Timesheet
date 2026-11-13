// Transitions de statut d'une fiche de temps (PROMPT.md §9.3).
import type { StoredStatus } from "./rules";

export type TimesheetAction = "SUBMIT" | "VALIDATE" | "REJECT";

const NEXT: Record<StoredStatus, Partial<Record<TimesheetAction, StoredStatus>>> = {
  DRAFT: { SUBMIT: "SUBMITTED" },
  REJECTED: { SUBMIT: "SUBMITTED" },
  SUBMITTED: { VALIDATE: "VALIDATED", REJECT: "REJECTED" },
  VALIDATED: {},
};

export function nextStatus(from: StoredStatus, action: TimesheetAction): StoredStatus | null {
  return NEXT[from][action] ?? null;
}

/** Une fiche se modifie en brouillon ou après rejet ; validée, seulement si la division ne la verrouille pas. */
export function isEditable(status: StoredStatus, lockAfterValidation: boolean): boolean {
  if (status === "DRAFT" || status === "REJECTED") return true;
  if (status === "VALIDATED") return !lockAfterValidation;
  return false;
}
