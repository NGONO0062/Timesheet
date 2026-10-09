// Vocabulaire unique des statuts (planche C4-Etiquettes-statut).
// Seul <StatusBadge> l'utilise : aucun autre libellé de statut n'est admis.
import { dict, t } from "./i18n";
import type { DayStatus, DisplayStatus } from "./timesheet/rules";

export type ProjectStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "DONE";
export type AttendanceStatus = "GENERATED" | "SIGNED_BY_INTERN" | "SIGNED_BY_SUPERVISOR" | "SENT";

export type DivisionStatus = "ACTIVE" | "ONBOARDING" | "SUSPENDED";
export type AuditResult = "SUCCESS" | "FAILURE";

export type StatusKind = "project" | "timesheet" | "day" | "attendance" | "division" | "audit";

export type StatusValue = {
  project: ProjectStatus;
  timesheet: DisplayStatus;
  day: DayStatus;
  attendance: AttendanceStatus;
  division: DivisionStatus;
  audit: AuditResult;
};

type Look = { label: string; className: string };

const TONE = {
  neutral: "",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
} as const;

const LOOKS: { [K in StatusKind]: Record<StatusValue[K], string> } = {
  project: {
    NOT_STARTED: "ts-st-todo",
    IN_PROGRESS: "ts-st-progress",
    ON_HOLD: "ts-st-hold",
    DONE: "ts-st-done",
  },
  timesheet: {
    DRAFT: TONE.neutral,
    SUBMITTED: TONE.info,
    REJECTED: TONE.danger,
    VALIDATED: TONE.success,
    MISSING: TONE.warning,
  },
  day: {
    UPCOMING: TONE.neutral,
    TODO: TONE.warning,
    PARTIAL: TONE.warning,
    COMPLETE: TONE.success,
    OVER: TONE.danger,
    TO_FIX: TONE.danger,
  },
  attendance: {
    GENERATED: TONE.warning,
    SIGNED_BY_INTERN: TONE.info,
    SIGNED_BY_SUPERVISOR: TONE.success,
    SENT: TONE.success,
  },
  division: {
    ACTIVE: TONE.success,
    ONBOARDING: TONE.info,
    SUSPENDED: TONE.warning,
  },
  audit: {
    SUCCESS: TONE.success,
    FAILURE: TONE.danger,
  },
};

/** `params` : valeurs du libellé (« Onboarding · étape {step} sur 5 »). */
export function statusLook<K extends StatusKind>(kind: K, value: StatusValue[K], params?: Record<string, string | number>): Look {
  const labels = dict.status[kind] as Record<StatusValue[K], string>;
  const classes = LOOKS[kind] as Record<StatusValue[K], string>;
  return { label: params ? t(labels[value], params) : labels[value], className: classes[value] };
}

/** Ordre d'affichage des statuts de projet (tri, colonnes, menu). */
export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["IN_PROGRESS", "NOT_STARTED", "ON_HOLD", "DONE"];
