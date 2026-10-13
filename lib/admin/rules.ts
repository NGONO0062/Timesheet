// Administration de division (PROMPT.md §9.9) et paramètres (§9.11) : règles pures,
// contrôle des formulaires avant la couche de données.
import { formatFrDate, NBSP, parseFrDate } from "../format";
import { dict } from "../i18n";
import { DEFAULT_MATRIX, DIVISION_ROLES, isLocked, PERMISSIONS, type DivisionRole, type MatrixOverride, type Permission } from "../permissions";

export const USERS_PAGE_SIZE = 5;
export const REMINDER_DAYS = [2, 3, 5] as const;
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

/**
 * Saisie en jours entiers (décision du 13/10/2026, questions ouvertes point 82) :
 * une journée vaut 1, sur un seul projet. Plus d'unité, d'heures par jour ni de pas à régler.
 */
export const DAY_ENTRY = { unit: "DAYS", hoursPerDay: 1, step: 1 } as const;

export type RulesInput = {
  workingDays: string[];
  deadlineDay: string;
  deadlineTime: string;
  fillAlertThreshold: string;
  allowFutureWeeks: boolean;
  lockAfterValidation: boolean;
};
export type RulesErrors = Partial<Record<"workingDays" | "deadline" | "threshold", string>>;

/** Nombre saisi en français (« 7,5 ») ; null si invalide. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Changements lisibles d'une règle à l'autre, pour l'objet du journal d'audit. */
export function describeRules(before: RulesInput, after: RulesInput): string[] {
  const a = dict.admin;
  const onOff = (v: boolean) => (v ? dict.form.active : dict.form.inactive);
  const view = (r: RulesInput): Array<[string, string]> => [
    [a.workingDays, WEEKDAY_KEYS.filter((d) => r.workingDays.includes(d)).map((d) => dict.weekdaysShort[WEEKDAY_KEYS.indexOf(d)]).join(", ")],
    [a.deadline, `${a.deadlineDays[r.deadlineDay as (typeof DEADLINE_DAYS)[number]] ?? r.deadlineDay} ${r.deadlineTime.trim()}`],
    [a.threshold, `${r.fillAlertThreshold.trim()}${NBSP}%`],
    [a.futureWeeks, onOff(r.allowFutureWeeks)],
    [a.lockAfterValidation, onOff(r.lockAfterValidation)],
  ];
  const old = view(before);
  return view(after)
    .filter(([, value], i) => value !== old[i]![1])
    .map(([label, value]) => `${label} : ${value}`);
}

export function checkRules(r: RulesInput): RulesErrors {
  const e: RulesErrors = {};
  if (r.workingDays.length === 0 || r.workingDays.some((d) => !(WEEKDAY_KEYS as readonly string[]).includes(d))) e.workingDays = dict.admin.errors.workingDays;
  if (!(DEADLINE_DAYS as readonly string[]).includes(r.deadlineDay) || !isTime(r.deadlineTime)) e.deadline = dict.admin.errors.deadline;
  const threshold = parseNumber(r.fillAlertThreshold);
  if (threshold === null || !Number.isInteger(threshold) || threshold < 0 || threshold > 100) e.threshold = dict.admin.errors.threshold;
  return e;
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

export const INTERNSHIP_KINDS = ["ACADEMIC", "PROFESSIONAL", "GRADUATE"] as const;
export type InternshipKind = (typeof INTERNSHIP_KINDS)[number];

/** Stage déclaré par l'admin de division (§9.11), dates au format jj/mm/aaaa. */
export type InternshipInput = { kind: string; direction: string; department: string; service: string; start: string; end: string };

/**
 * `internship` : null retire le stage, absent le laisse tel quel. Seul un compte Staff
 * peut être stagiaire (PROMPT.md §7 : « STAFF, stagiaires compris »).
 */
export type UserInput = { email: string; firstName: string; lastName: string; role: DivisionRole; managerId: string | null; internship?: InternshipInput | null };
export type UserErrors = Partial<
  Record<"email" | "firstName" | "lastName" | "role" | "manager" | "internKind" | "internDirection" | "internDepartment" | "internService" | "internStart" | "internEnd", string>
>;

export function checkUser(u: UserInput, managerIds: readonly string[]): UserErrors {
  const e: UserErrors = {};
  const x = dict.admin.errors;
  if (!isEmail(u.email)) e.email = x.email;
  if (!u.firstName.trim()) e.firstName = x.firstName;
  if (!u.lastName.trim()) e.lastName = x.lastName;
  if (!DIVISION_ROLES.includes(u.role)) e.role = x.role;
  if (u.managerId && !managerIds.includes(u.managerId)) e.manager = x.manager;
  const i = u.internship;
  if (i) {
    if (u.role !== "STAFF") e.role = x.internRole;
    if (!(INTERNSHIP_KINDS as readonly string[]).includes(i.kind)) e.internKind = x.internKind;
    if (!i.direction.trim()) e.internDirection = x.internDirection;
    if (!i.department.trim()) e.internDepartment = x.internDepartment;
    if (!i.service.trim()) e.internService = x.internService;
    const start = parseFrDate(i.start);
    const end = parseFrDate(i.end);
    if (!start) e.internStart = x.internStart;
    if (!end || (start && end < start)) e.internEnd = x.internEnd;
  }
  return e;
}

/** Stage contrôlé par `checkUser` → colonnes de la table Internship. */
export function internshipData(i: InternshipInput) {
  return {
    kind: i.kind as InternshipKind,
    direction: i.direction.trim(),
    department: i.department.trim(),
    service: i.service.trim(),
    startDate: parseFrDate(i.start)!,
    endDate: parseFrDate(i.end)!,
  };
}

/** Stage enregistré → valeurs du formulaire. */
export function internshipInput(i: { kind: string; direction: string; department: string; service: string; startDate: Date; endDate: Date }): InternshipInput {
  return { kind: i.kind, direction: i.direction, department: i.department, service: i.service, start: formatFrDate(i.startDate), end: formatFrDate(i.endDate) };
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
