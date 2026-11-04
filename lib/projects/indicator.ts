// Indicateur d'un projet DMAIC (PROMPT.md §9.4, lot 3) : la mesure que le projet doit
// faire bouger, avec sa valeur de départ, sa cible et la valeur atteinte. Pur.
import { formatNumber, formatPercent, NBSP } from "../format";
import { dict, t } from "../i18n";

const d = dict.dmaic;

export type IndicatorInput = { name: string; unit: string; baseline: string; target: string; current: string };
export type Indicator = { name: string; unit: string | null; baseline: number; target: number; current: number | null };
export type IndicatorErrors = Partial<Record<"name" | "baseline" | "target" | "current", string>>;

/** « 12 », « 12,5 », « −3 », « 1 200,25 » ; null si ce n'est pas un nombre (deux décimales au plus). */
export function parseDecimal(raw: string): number | null {
  const s = raw.replace(/[\s  ]/g, "").replace("−", "-").replace(",", ".");
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/**
 * Contrôle du formulaire. Tout vide : l'indicateur est retiré (`value` null). Sinon,
 * nom, départ et cible sont requis ; la valeur atteinte est facultative.
 */
export function checkIndicator(input: IndicatorInput): { ok: true; value: Indicator | null } | { ok: false; errors: IndicatorErrors } {
  const v = { name: input.name.trim(), unit: input.unit.trim(), baseline: input.baseline.trim(), target: input.target.trim(), current: input.current.trim() };
  if (!v.name && !v.unit && !v.baseline && !v.target && !v.current) return { ok: true, value: null };
  const errors: IndicatorErrors = {};
  if (!v.name) errors.name = d.errors.indicatorName;
  const baseline = parseDecimal(v.baseline);
  const target = parseDecimal(v.target);
  const current = v.current ? parseDecimal(v.current) : null;
  if (baseline === null) errors.baseline = d.errors.indicatorNumber;
  if (target === null) errors.target = d.errors.indicatorNumber;
  else if (baseline !== null && baseline === target) errors.target = d.errors.indicatorSame;
  if (v.current && current === null) errors.current = d.errors.indicatorNumber;
  if (Object.keys(errors).length > 0 || baseline === null || target === null) return { ok: false, errors };
  return { ok: true, value: { name: v.name.slice(0, 200), unit: v.unit ? v.unit.slice(0, 40) : null, baseline, target, current } };
}

/** Nombre suivi de l'unité, avec espace insécable : « 12 jours », « 85 % ». */
export function withUnit(n: number, unit: string | null): string {
  return unit ? `${formatNumber(n)}${NBSP}${unit}` : formatNumber(n);
}

/**
 * Part de l'écart comblé entre la valeur de départ et la cible, quel que soit le sens
 * (baisser ou monter), bornée entre 0 et 1. Null tant que rien n'est mesuré.
 */
export function indicatorProgress(i: Indicator): { ratio: number; reached: boolean; wrongWay: boolean } | null {
  if (i.current === null || i.target === i.baseline) return null;
  const raw = (i.current - i.baseline) / (i.target - i.baseline);
  return { ratio: Math.min(1, Math.max(0, raw)), reached: raw >= 1, wrongWay: raw < 0 };
}

/** Textes affichés sous le titre « Indicateur du projet ». */
export function indicatorTexts(i: Indicator): { goal: string; facts: string; progress: string | null } {
  const from = withUnit(i.baseline, i.unit);
  const to = withUnit(i.target, i.unit);
  const p = indicatorProgress(i);
  return {
    goal: t(i.target < i.baseline ? d.indicatorDown : d.indicatorUp, { from, to }),
    facts: i.current === null ? t(d.indicatorFactsNoCurrent, { from, to }) : t(d.indicatorFacts, { from, to, current: withUnit(i.current, i.unit) }),
    progress: p === null ? null : p.reached ? d.indicatorReached : p.wrongWay ? d.indicatorWrongWay : t(d.indicatorProgress, { percent: formatPercent(p.ratio) }),
  };
}

/** Valeurs du formulaire à partir de l'indicateur enregistré. */
export function indicatorForm(i: Indicator | null): IndicatorInput {
  if (!i) return { name: "", unit: "", baseline: "", target: "", current: "" };
  const n = (x: number) => String(x).replace(".", ",");
  return { name: i.name, unit: i.unit ?? "", baseline: n(i.baseline), target: n(i.target), current: i.current === null ? "" : n(i.current) };
}
