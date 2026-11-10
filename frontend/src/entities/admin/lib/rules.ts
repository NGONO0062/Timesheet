// Règles d'affichage de l'écran 12 : rôles et permissions dans l'ordre de la planche,
// matrice, champs et codes d'erreur de l'API traduits en messages.
import type { Permission } from "@/entities/viewer";
import { ApiError } from "@/shared/api/http";
import { dict } from "@/shared/i18n";
import type { DivisionRole, Matrix, Weekday } from "../api/types";

export const DIVISION_ROLES: DivisionRole[] = ["STAFF", "MANAGER", "OWNER", "DIVISION_ADMIN"];
export const PERMISSIONS: Permission[] = ["ENTER_TIME", "VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING", "VIEW_DIVISION", "ADMINISTER_DIVISION"];
export const WEEKDAYS: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const REMINDER_DAYS = [2, 3, 5] as const;
export const DEADLINE_DAYS = ["FRIDAY", "MONDAY"] as const;
export const INTERNSHIP_KINDS = ["ACADEMIC", "PROFESSIONAL", "GRADUATE"] as const;

/** La dernière permission de l'admin de division ne se retire pas. */
export const isLocked = (role: DivisionRole, permission: Permission) => role === "DIVISION_ADMIN" && permission === "ADMINISTER_DIVISION";

export function toggleMatrix(m: Matrix, role: DivisionRole, permission: Permission, on: boolean): Matrix {
  return { ...m, [role]: on ? PERMISSIONS.filter((p) => p === permission || m[role].includes(p)) : m[role].filter((p) => p !== permission) };
}

/** Réponse 422 de l'API : son code et ses champs en erreur. */
export function ruleOf(e: unknown): { code: string; fields: string[] } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { code: "session", fields: [] };
    const body = e.body as { code?: string; fields?: string[] } | null;
    if (e.status === 404) return { code: "notFound", fields: [] };
    if (body?.code) return { code: body.code, fields: body.fields ?? [] };
  }
  return { code: "unknown", fields: [] };
}

type AdminErrorKey = keyof typeof dict.admin.errors;

/** Message d'un champ ou d'un code d'erreur de l'administration. */
export function adminMessage(key: string): string {
  const errors = dict.admin.errors;
  return key in errors ? errors[key as AdminErrorKey] : errors.unknown;
}

/** Champs en erreur → messages, sous chaque champ. `emailTaken` s'affiche sous l'adresse. */
export function fieldMessages(fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f === "emailTaken") out.email = adminMessage("emailTaken");
    else out[f] = adminMessage(f);
  }
  return out;
}
