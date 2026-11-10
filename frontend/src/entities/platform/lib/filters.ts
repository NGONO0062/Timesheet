// Filtres du journal d'audit dans l'adresse (planche 13) et proposition d'identifiant d'une
// division (onboarding, étape 1). Purs et testés.
import type { AuditFilters } from "../api/types";

export const AUDIT_CATEGORIES = ["LOGIN", "SUBMISSIONS", "VALIDATIONS", "REJECTIONS", "REMINDERS", "SIGNATURES", "HR", "RULES", "USERS", "PROJECTS", "DIVISIONS"] as const;

/** Filtres lus dans l'adresse : division, type, du, au, q, page. */
export function parseAuditParams(p: URLSearchParams): AuditFilters {
  const page = Number(p.get("page") ?? 1);
  return {
    division: p.get("division"),
    type: p.get("type"),
    from: p.get("du"),
    to: p.get("au"),
    q: p.get("q") ?? "",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Paramètres d'adresse (et d'API) des filtres ; `withPage` : la page aussi. */
export function auditQuery(f: AuditFilters, withPage = false): URLSearchParams {
  const p = new URLSearchParams();
  if (f.division) p.set("division", f.division);
  if (f.type) p.set("type", f.type);
  if (f.from) p.set("du", f.from);
  if (f.to) p.set("au", f.to);
  if (f.q) p.set("q", f.q);
  if (withPage && f.page > 1) p.set("page", String(f.page));
  return p;
}

/** Identifiant proposé à partir du nom : « Relation client B2B » → « relation-client-b2b ». */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Étapes de l'onboarding d'une division (écran 13). */
export const ONBOARDING_STEPS = 5;
