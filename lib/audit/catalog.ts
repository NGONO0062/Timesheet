// Catalogue du journal d'audit (PROMPT.md §9.10) : chaque action, son libellé et sa
// famille pour le filtre « Type d'action ». Pur : partagé par la couche de données,
// l'écran et les exports.

export const AUDIT_CATEGORIES = {
  LOGIN: ["LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGOUT"],
  SUBMISSIONS: ["TIMESHEET_SUBMITTED"],
  VALIDATIONS: ["TIMESHEET_VALIDATED"],
  REJECTIONS: ["TIMESHEET_REJECTED"],
  REMINDERS: ["VALIDATION_REMINDER_SENT", "FILL_REMINDER_SENT"],
  SIGNATURES: ["ATTENDANCE_GENERATED", "ATTENDANCE_SIGNED", "ATTENDANCE_SIGNATURE_FAILURE", "ATTENDANCE_REJECTED"],
  HR: ["ATTENDANCE_SENT"],
  RULES: ["RULES_CHANGED", "WORKFLOW_CHANGED", "PERMISSIONS_CHANGED"],
  USERS: ["USER_INVITED", "USER_UPDATED", "USER_ROLE_CHANGED", "USER_ACTIVATED", "USER_DEACTIVATED", "INVITATION_ACCEPTED", "PASSWORD_RESET", "PASSWORD_CHANGED"],
  PROJECTS: ["PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_STATUS_CHANGED", "PROJECT_ARCHIVED", "PROJECT_UNARCHIVED"],
  DIVISIONS: ["DIVISION_CREATED", "DIVISION_UPDATED", "DIVISION_SUSPENDED", "DIVISION_ACTIVATED"],
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORIES;
export type AuditAction = (typeof AUDIT_CATEGORIES)[AuditCategory][number];

export const AUDIT_ACTIONS: AuditAction[] = Object.values(AUDIT_CATEGORIES).flat();

export function isAuditCategory(s: string | undefined): s is AuditCategory {
  return s !== undefined && Object.hasOwn(AUDIT_CATEGORIES, s);
}
