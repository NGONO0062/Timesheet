// Filtres du journal d'audit (PROMPT.md §9.10), lus dans l'adresse : division, type
// d'action, période (jj/mm/aaaa, jours de Douala), acteur ou objet. Purs et testés.
import { formatFrDate, parseFrDate } from "../format";
import { dict } from "../i18n";
import { addDays, isoWeekday } from "../iso-week";
import { isAuditCategory, type AuditCategory } from "./catalog";

export const AUDIT_PAGE_SIZE = 20;
/** Douala : UTC+1, sans heure d'été. */
const OFFSET_MS = 60 * 60_000;

export type AuditFilters = {
  divisionId: string | null;
  category: AuditCategory | null;
  q: string;
  fromText: string;
  toText: string;
  /** Instants : [from, to[ */
  from: Date;
  to: Date;
  page: number;
};

export type AuditParams = { division?: string; type?: string; du?: string; au?: string; q?: string; page?: string };

/** Période par défaut : du lundi au vendredi de la semaine en cours (planche 13), aujourd'hui compris. */
export function defaultPeriod(today: Date): { from: Date; to: Date } {
  const monday = addDays(today, -isoWeekday(today));
  const friday = addDays(monday, 4);
  return { from: monday, to: today > friday ? today : friday };
}

export function parseAuditFilters(sp: AuditParams, today: Date): { filters: AuditFilters; errors: { from?: string; to?: string } } {
  const errors: { from?: string; to?: string } = {};
  const def = defaultPeriod(today);
  const fromText = (sp.du ?? formatFrDate(def.from)).trim();
  const toText = (sp.au ?? formatFrDate(def.to)).trim();
  let from = parseFrDate(fromText);
  let to = parseFrDate(toText);
  if (!from) errors.from = dict.audit.errors.date;
  if (!to) errors.to = dict.audit.errors.date;
  if (from && to && to < from) errors.to = dict.audit.errors.order;
  if (errors.from || errors.to) {
    from = def.from;
    to = def.to;
  }
  const page = Number(sp.page ?? 1);
  return {
    errors,
    filters: {
      divisionId: sp.division && /^[a-z0-9]{1,64}$/i.test(sp.division) ? sp.division : null,
      category: isAuditCategory(sp.type) ? sp.type : null,
      q: (sp.q ?? "").trim().slice(0, 100),
      fromText,
      toText,
      from: new Date(from!.getTime() - OFFSET_MS),
      to: new Date(addDays(to!, 1).getTime() - OFFSET_MS),
      page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
    },
  };
}

/** Paramètres d'adresse des filtres (pagination, export), sans la page. */
export function auditQuery(f: AuditFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.divisionId) p.set("division", f.divisionId);
  if (f.category) p.set("type", f.category);
  p.set("du", f.fromText);
  p.set("au", f.toText);
  if (f.q) p.set("q", f.q);
  return p;
}
