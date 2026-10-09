// Administration de division (PROMPT.md §9.9) et paramètres (§9.11) : règles pures,
// contrôle des formulaires avant la couche de données.
import { dict } from "../i18n";
import { DEFAULT_MATRIX, DIVISION_ROLES, isLocked, PERMISSIONS, type DivisionRole, type MatrixOverride, type Permission } from "../permissions";

export const USERS_PAGE_SIZE = 5;
export const REMINDER_DAYS = [2, 3, 5] as const;
export const STEPS = [0.25, 0.5, 1] as const;
export const DEADLINE_DAYS = ["FRIDAY", "MONDAY"] as const;
export const WEEKDAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isEmail = (s: string) => EMAIL.test(s.trim());
export const isTime = (s: string) => TIME.test(s.trim());

// ---------------------------------------------------------------------------
// Matrice des permissions
// ---------------------------------------------------------------------------

export type Matrix = Record<DivisionRole, Permission[]>;

/** Matrice effective d'une division : la matrice par défaut, puis ses réglages. */
export function matrixOf(overrides: readonly MatrixOverride[]): Matrix {
  const out = {} as Matrix;
  for (const role of DIVISION_ROLES) {
    const granted = new Set<Permission>(DEFAULT_MATRIX[role]);
    for (const o of overrides) {
      if (o.role !== role || isLocked(role, o.permission)) continue;
      if (o.granted) granted.add(o.permission);
      else granted.delete(o.permission);
    }
    out[role] = PERMISSIONS.filter((p) => granted.has(p));
  }
  return out;
}

/** Réglages à enregistrer : seulement les écarts à la matrice par défaut ; la permission verrouillée reste accordée. */
export function overridesFor(matrix: Matrix): MatrixOverride[] {
  const out: MatrixOverride[] = [];
  for (const role of DIVISION_ROLES) {
    for (const permission of PERMISSIONS) {
      if (isLocked(role, permission)) continue;
      const wanted = matrix[role].includes(permission);
      if (wanted !== DEFAULT_MATRIX[role].includes(permission)) out.push({ role, permission, granted: wanted });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Workflow et règles de saisie
// ---------------------------------------------------------------------------

export type WorkflowInput = { ownerValidation: boolean; hrAutoSend: boolean; hrEmail: string; reminderAfterWorkingDays: number; delegateToOwner: boolean };
export type WorkflowErrors = Partial<Record<"hrEmail" | "reminder", string>>;

export function checkWorkflow(w: WorkflowInput): WorkflowErrors {
  const e: WorkflowErrors = {};
  if (!isEmail(w.hrEmail)) e.hrEmail = dict.admin.errors.hrEmail;
  if (!(REMINDER_DAYS as readonly number[]).includes(w.reminderAfterWorkingDays)) e.reminder = dict.admin.errors.reminder;
  return e;
}

export type RulesInput = {
  unit: "HOURS" | "DAYS";
  workingDays: string[];
  hoursPerDay: string;
  step: number;
  deadlineDay: string;
  deadlineTime: string;
  fillAlertThreshold: string;
  allowFutureWeeks: boolean;
  lockAfterValidation: boolean;
};
export type RulesErrors = Partial<Record<"workingDays" | "hoursPerDay" | "step" | "deadline" | "threshold", string>>;

/** Nombre saisi en français (« 7,5 ») ; null si invalide. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function checkRules(r: RulesInput): RulesErrors {
  const e: RulesErrors = {};
  if (r.workingDays.length === 0 || r.workingDays.some((d) => !(WEEKDAY_KEYS as readonly string[]).includes(d))) e.workingDays = dict.admin.errors.workingDays;
  const hours = parseNumber(r.hoursPerDay);
  if (hours === null || hours <= 0 || hours > 24 || Math.round(hours * 4) !== hours * 4) e.hoursPerDay = dict.admin.errors.hoursPerDay;
  if (!(STEPS as readonly number[]).includes(r.step)) e.step = dict.admin.errors.step;
  if (!(DEADLINE_DAYS as readonly string[]).includes(r.deadlineDay) || !isTime(r.deadlineTime)) e.deadline = dict.admin.errors.deadline;
  const threshold = parseNumber(r.fillAlertThreshold);
  if (threshold === null || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) e.threshold = dict.admin.errors.threshold;
  return e;
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

export type UserInput = { email: string; firstName: string; lastName: string; role: DivisionRole; managerId: string | null };
export type UserErrors = Partial<Record<"email" | "firstName" | "lastName" | "role" | "manager", string>>;

export function checkUser(u: UserInput, managerIds: readonly string[]): UserErrors {
  const e: UserErrors = {};
  if (!isEmail(u.email)) e.email = dict.admin.errors.email;
  if (!u.firstName.trim()) e.firstName = dict.admin.errors.firstName;
  if (!u.lastName.trim()) e.lastName = dict.admin.errors.lastName;
  if (!DIVISION_ROLES.includes(u.role)) e.role = dict.admin.errors.role;
  if (u.managerId && !managerIds.includes(u.managerId)) e.manager = dict.admin.errors.manager;
  return e;
}

/** Pages de la liste : « Utilisateurs 1 à 5 sur 21 ». */
export function pageOf(total: number, requested: number, size = USERS_PAGE_SIZE) {
  const count = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1), count);
  return { page, count, from: total === 0 ? 0 : (page - 1) * size + 1, to: Math.min(total, page * size), skip: (page - 1) * size };
}

// ---------------------------------------------------------------------------
// Mot de passe (politique à confirmer : docs/questions-ouvertes.md)
// ---------------------------------------------------------------------------

export const PASSWORD_MIN = 12;

/** Erreur du nouveau mot de passe, ou null. */
export function checkNewPassword(next: string, confirm: string): { field: "next" | "confirm"; message: string } | null {
  if (next.length < PASSWORD_MIN || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return { field: "next", message: dict.settings.errors.passwordRules };
  if (next !== confirm) return { field: "confirm", message: dict.settings.errors.passwordConfirm };
  return null;
}
