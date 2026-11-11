// Administration de division (écran 12), telle que l'API la renvoie (/api/v1/administration).
import type { Permission, Role } from "@/entities/viewer";

export type DivisionRole = Exclude<Role, "PLATFORM_ADMIN">;

export type Matrix = Record<DivisionRole, Permission[]>;

export type InternshipInput = { kind: string; direction: string; department: string; service: string; start: string; end: string };

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: DivisionRole;
  managerId: string | null;
  manager: string | null;
  active: boolean;
  internship: InternshipInput | null;
  /** Invitation envoyée, mot de passe pas encore choisi. */
  invited: boolean;
  isSelf: boolean;
};

export type UsersPage = { rows: AdminUser[]; total: number; from: number; to: number; page: number; count: number; query: string };

export type Workflow = { ownerValidation: boolean; hrAutoSend: boolean; hrEmail: string; reminderAfterWorkingDays: number; delegateToOwner: boolean };

export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type Rules = {
  workingDays: Weekday[];
  deadlineDay: "FRIDAY" | "MONDAY";
  deadlineTime: string;
  fillAlertThreshold: string;
  allowFutureWeeks: boolean;
  lockAfterValidation: boolean;
};

/** Jour férié de la division ; `date` au format aaaa-mm-jj. */
export type Holiday = { id: string; date: string; label: string };

/** `years` : années qui ont un jour férié, l'année en cours et la suivante. */
export type Holidays = { currentYear: number; years: number[]; rows: Holiday[] };

/** `enteredDays` : journées déjà saisies ce jour-là dans la division. */
export type HolidayAdded = Holiday & { enteredDays: number };

export type Admin = {
  divisionName: string;
  managers: Array<{ id: string; name: string }>;
  matrix: Matrix;
  workflow: Workflow;
  rules: Rules;
};

export type UserInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: DivisionRole;
  managerId: string | null;
  internship: InternshipInput | null;
};
