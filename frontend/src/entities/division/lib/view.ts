// Mise en forme de la vue consolidée (planche 11), reprise de lib/division/consolidated.ts :
// l'API donne les chiffres, ce module écrit les textes. Pur.
import { dict, t } from "@/shared/i18n";
import { formatDays, formatNumber, NBSP } from "@/shared/lib/format";
import type { Drift, TeamRow, WeekBlock } from "../api/queries";

const d = dict.division;
/** Hauteur des colonnes de la tendance, en unités du dessin (100 % la remplit). */
const TREND_HEIGHT = 160;

const plural = (n: number, one: string, many: string) => t(n > 1 ? many : one, { n });
export const pct = (n: number) => `${n}${NBSP}%`;

export const teamAnchor = (teamId: string) => `equipe-${teamId}`;

/** Remplissage d'une ligne du tableau : « 83 % · 200 / 240 jours ». */
export const fillText = (r: TeamRow) => t(d.teamFill, { pct: pct(r.fill), entered: formatNumber(r.entered), capacity: formatDays(r.capacity) });

/** Indicateurs de la semaine (planche 11) : remplissage, fiches soumises, fiches validées. */
export function kpiTexts(total: TeamRow) {
  const notSubmitted = total.persons - total.submitted;
  const pending = total.submitted - total.validated;
  return {
    fill: pct(total.fill),
    fillDetail: t(d.fillDetail, { entered: formatDays(total.entered), capacity: formatDays(total.capacity) }),
    submitted: t(d.of, { n: total.submitted, total: total.persons }),
    submittedDetail: total.submitted === 0 ? d.noSheetTitle : notSubmitted === 0 ? d.allSubmitted : plural(notSubmitted, d.notSubmittedOne, d.notSubmittedMany),
    validated: t(d.of, { n: total.validated, total: total.persons }),
    validatedDetail: pending === 0 ? d.nonePending : t(d.pendingAtManagers, { n: pending }),
  };
}

/** Colonnes de la tendance : une couleur (le bleu), colonne évidée pour la semaine en cours. */
export function trendColumns(trend: WeekBlock["trend"]) {
  return trend.map((p) => ({
    key: `${p.year}-${p.week}`,
    label: t(d.trendWeek, { week: p.week }),
    open: p.open,
    totalText: pct(p.fill),
    height: Math.round((Math.min(p.fill, 100) * TREND_HEIGHT) / 100),
    title: t(p.open ? d.trendMarkOpen : d.trendMark, { week: p.week, pct: pct(p.fill) }),
  }));
}

export type DriftAction = { kind: "link"; href: string; label: string } | { kind: "remindManager" | "remindPerson"; label: string };

/** Textes d'une ligne du tableau des dérives : type, objet, écart, responsable, action. */
export function driftRow(drift: Drift): { tone: "danger" | "warning"; type: string; object: string; gap: string; owner: string; action: DriftAction } {
  const type = d.type[drift.kind];
  const owner = drift.owner ?? "";
  switch (drift.kind) {
    case "BUDGET": {
      const consumed = drift.consumed ?? 0;
      const budget = drift.budget ?? 0;
      return {
        tone: "danger",
        type,
        object: drift.label,
        gap: t(d.budgetGap, { consumed: formatDays(consumed), budget: formatDays(budget), over: formatDays(consumed - budget) }),
        owner,
        action: { kind: "link", href: `/projets?projet=${encodeURIComponent(drift.targetId)}`, label: d.seeProject },
      };
    }
    case "UNDERFILL":
      return {
        tone: "danger",
        type,
        object: t(d.underfillObject, { name: drift.label, week: drift.week ?? "" }),
        gap: t(d.underfillGap, { pct: pct(drift.fill ?? 0), threshold: pct(drift.threshold ?? 0) }),
        owner,
        action: { kind: "link", href: `#${teamAnchor(drift.targetId)}`, label: d.seeTeam },
      };
    case "LATE_VALIDATION":
      return {
        tone: "warning",
        type,
        object: t(d.lateObject, { name: drift.label }),
        gap: t((drift.count ?? 0) > 1 ? d.lateGapMany : d.lateGapOne, { n: drift.count ?? 0, days: drift.days ?? 0 }),
        owner,
        action: { kind: "remindManager", label: d.remindManager },
      };
    case "MISSING":
      return {
        tone: "warning",
        type,
        object: t(d.missingObject, { name: drift.label, week: drift.week ?? "" }),
        gap: t(d.missingGap, { hours: formatDays(drift.missing ?? 0) }),
        owner,
        action: { kind: "remindPerson", label: d.remind },
      };
  }
}
