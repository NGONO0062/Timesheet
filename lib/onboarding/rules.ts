// Onboarding d'une division (PROMPT.md §9.10, planche 13-Onboarding-division) : règles
// pures des étapes 1 et 2, contrôlées avant la couche de données.
import { isEmail } from "../admin/rules";
import { dict } from "../i18n";

export const ONBOARDING_STEPS = 5;
/** Division pilote : sa configuration peut être reprise, jamais ses données. */
export const PILOT_SLUG = "cx-expertise";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

/** Identifiant proposé à partir du nom : « Relation client B2B » → « relation-client-b2b ». */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export const isSlug = (s: string) => SLUG.test(s) && !s.includes("--");

export type IdentityInput = { name: string; slug: string; direction: string };
export type IdentityErrors = Partial<Record<keyof IdentityInput, string>>;

export function checkIdentity(i: IdentityInput): IdentityErrors {
  const e: IdentityErrors = {};
  if (!i.name.trim()) e.name = dict.onboarding.errors.name;
  if (!isSlug(i.slug.trim())) e.slug = dict.onboarding.errors.slug;
  if (!i.direction.trim()) e.direction = dict.onboarding.errors.direction;
  return e;
}

export type AdminInput = { fullName: string; email: string; config: "COPY" | "BLANK" };
export type AdminErrors = Partial<Record<"fullName" | "email", string>>;

/** « Nom complet » : le premier mot est le prénom, le reste le nom. */
export function splitName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function checkAdmin(a: AdminInput): AdminErrors {
  const e: AdminErrors = {};
  if (!splitName(a.fullName)) e.fullName = dict.onboarding.errors.fullName;
  if (!isEmail(a.email)) e.email = dict.onboarding.errors.email;
  return e;
}
