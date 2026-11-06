// Vocabulaire unique des statuts (planche C4-Etiquettes-statut).
// Seul <StatusBadge> l'utilise : aucun autre libellé de statut n'est admis.
import { dict, t } from "@/shared/i18n";

export type ProjectStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "DONE";
export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "REJECTED" | "VALIDATED" | "MISSING";
export type DayStatus = "UPCOMING" | "TODO" | "PARTIAL" | "COMPLETE" | "OVER" | "TO_FIX";
export type AttendanceStatus = "GENERATED" | "SIGNED_BY_INTERN" | "SIGNED_BY_SUPERVISOR" | "SENT";
export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type DivisionStatus = "ACTIVE" | "ONBOARDING" | "SUSPENDED";
export type AuditResult = "SUCCESS" | "FAILURE";

export type StatusKind = "project" | "timesheet" | "day" | "attendance" | "division" | "audit" | "task";

export type StatusValue = {
  project: ProjectStatus;
  timesheet: TimesheetStatus;
  day: DayStatus;
  attendance: AttendanceStatus;
  division: DivisionStatus;
  audit: AuditResult;
  task: TaskStatus;
};

/** Couleur de fond de l'étiquette ; elle accompagne toujours un symbole et un libellé. */
export type Tone = "neutral" | "success" | "danger" | "warning" | "info";

/**
 * Symbole devant le libellé : la couleur ne porte jamais l'information seule, et deux
 * statuts de même couleur mais de sens différent ont deux formes (docs/design-v2.md) :
 * coche = fait ; croix = refusé, à corriger ; ! = en retard, bloqué ; sablier = en attente
 * d'une autre personne ; crayon = une action vous attend ; lecture = en cours ;
 * pause = suspendu ; cercle = pas commencé ; aucun = brouillon, neutre.
 */
export type Glyph = "none" | "check" | "cross" | "bang" | "info" | "todo" | "play" | "pause" | "hourglass" | "pencil";

export type Look = { label: string; tone: Tone; glyph: Glyph };

const GLYPHS: { [K in StatusKind]: Record<StatusValue[K], Glyph> } = {
  project: { NOT_STARTED: "todo", IN_PROGRESS: "play", ON_HOLD: "pause", DONE: "check" },
  timesheet: { DRAFT: "none", SUBMITTED: "hourglass", REJECTED: "cross", VALIDATED: "check", MISSING: "bang" },
  day: { UPCOMING: "none", TODO: "pencil", PARTIAL: "pencil", COMPLETE: "check", OVER: "cross", TO_FIX: "cross" },
  attendance: { GENERATED: "pencil", SIGNED_BY_INTERN: "hourglass", SIGNED_BY_SUPERVISOR: "check", SENT: "check" },
  division: { ACTIVE: "check", ONBOARDING: "play", SUSPENDED: "bang" },
  audit: { SUCCESS: "check", FAILURE: "cross" },
  task: { BACKLOG: "none", TODO: "todo", IN_PROGRESS: "play", REVIEW: "hourglass", DONE: "check" },
};

const TONES: { [K in StatusKind]: Record<StatusValue[K], Tone> } = {
  project: { NOT_STARTED: "neutral", IN_PROGRESS: "info", ON_HOLD: "warning", DONE: "success" },
  timesheet: { DRAFT: "neutral", SUBMITTED: "info", REJECTED: "danger", VALIDATED: "success", MISSING: "warning" },
  day: { UPCOMING: "neutral", TODO: "warning", PARTIAL: "warning", COMPLETE: "success", OVER: "danger", TO_FIX: "danger" },
  attendance: { GENERATED: "warning", SIGNED_BY_INTERN: "info", SIGNED_BY_SUPERVISOR: "success", SENT: "success" },
  division: { ACTIVE: "success", ONBOARDING: "info", SUSPENDED: "warning" },
  audit: { SUCCESS: "success", FAILURE: "danger" },
  // Colonnes du tableau Kanban (PROMPT.md §9.12) : le libellé dit l'état, la couleur suit.
  task: { BACKLOG: "neutral", TODO: "neutral", IN_PROGRESS: "info", REVIEW: "warning", DONE: "success" },
};

/** `params` : valeurs du libellé (« Onboarding · étape {step} sur 5 »). */
export function statusLook<K extends StatusKind>(kind: K, value: StatusValue[K], params?: Record<string, string | number>): Look {
  const labels = dict.status[kind] as Record<StatusValue[K], string>;
  const tone = (TONES[kind] as Record<StatusValue[K], Tone>)[value];
  const glyph = (GLYPHS[kind] as Record<StatusValue[K], Glyph>)[value];
  return { label: params ? t(labels[value], params) : labels[value], tone, glyph };
}

/** Colonnes du tableau Kanban, de gauche à droite. */
export const TASK_STATUS_ORDER: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];

/** Ordre d'affichage des statuts de projet (tri, colonnes, menu). */
export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["IN_PROGRESS", "NOT_STARTED", "ON_HOLD", "DONE"];
