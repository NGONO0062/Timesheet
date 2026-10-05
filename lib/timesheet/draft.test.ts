import { describe, expect, it } from "vitest";
import { utcDate } from "../iso-week";
import { actionLabel, historyAction, missingWeeks, projectPeriod, startsShort, todoCount, weeksBack } from "./dashboard";
import { lineKey, planDraft, planTotals, type ExistingLine } from "./draft";

const REFONTE = { projectId: "refonte", activityId: "tests" };
const NPS = { projectId: "nps", activityId: "analyse" };
const FAQ = { projectId: "faq", activityId: "redaction" };
const eligible = new Set([lineKey(REFONTE), lineKey(NPS)]);
const base = { eligible, step: 0.5, dayCount: 5 };

describe("contrôle d'un brouillon", () => {
  it("accepte les lignes autorisées et ne stocke que les jours saisis, zéro compris", () => {
    const r = planDraft({ ...base, existing: [], lines: [{ ...REFONTE, hours: [4, 0, 3, null, null] }] });
    expect(r).toEqual({
      ok: true,
      lines: [{ ...REFONTE, position: 0, entries: [{ day: 0, hours: 4, flagged: false }, { day: 1, hours: 0, flagged: false }, { day: 2, hours: 3, flagged: false }] }],
    });
  });

  it("refuse un projet hors de la liste autorisée, une ligne en double, une valeur hors pas", () => {
    expect(planDraft({ ...base, existing: [], lines: [{ ...FAQ, hours: [1, 0, 0, 0, 0] }] })).toEqual({ ok: false, error: "lineNotAllowed" });
    expect(planDraft({ ...base, existing: [], lines: [{ ...REFONTE, hours: [0, 0, 0, 0, 0] }, { ...REFONTE, hours: [0, 0, 0, 0, 0] }] })).toEqual({ ok: false, error: "lineNotAllowed" });
    for (const bad of [[0.3, 0, 0, 0, 0], [-1, 0, 0, 0, 0], [25, 0, 0, 0, 0], [Number.NaN, 0, 0, 0, 0], [1, 1, 1, 1]]) {
      expect(planDraft({ ...base, existing: [], lines: [{ ...REFONTE, hours: bad }] }), String(bad)).toEqual({ ok: false, error: "invalidHours" });
    }
  });

  it("garde en lecture seule la ligne d'un projet sorti de « En cours »", () => {
    const paused: ExistingLine = { ...FAQ, hours: [2, 2, null, null, null], flagged: [false, false, false, false, false], open: false };
    const r = planDraft({ ...base, existing: [paused], lines: [{ ...FAQ, hours: [8, 8, 8, 8, 8] }] });
    expect(r.ok && r.lines[0]!.entries.map((e) => e.hours)).toEqual([2, 2]);
    expect(planDraft({ ...base, existing: [paused], lines: [{ ...FAQ, hours: [0.3, 0, 0, 0, 0] }] }).ok).toBe(true);
  });

  it("lève le signalement d'une cellule dès que sa valeur change", () => {
    const flagged: ExistingLine = { ...REFONTE, hours: [4, 4, 3, 5, 4], flagged: [false, false, false, true, false], open: true };
    const same = planDraft({ ...base, existing: [flagged], lines: [{ ...REFONTE, hours: [4, 4, 3, 5, 4] }] });
    expect(same.ok && same.lines[0]!.entries.find((e) => e.day === 3)).toEqual({ day: 3, hours: 5, flagged: true });
    const fixed = planDraft({ ...base, existing: [flagged], lines: [{ ...REFONTE, hours: [4, 4, 3, 0, 4] }] });
    expect(fixed.ok && fixed.lines[0]!.entries.some((e) => e.flagged)).toBe(false);
  });

  it("additionne un plan par jour", () => {
    const r = planDraft({ ...base, existing: [], lines: [{ ...REFONTE, hours: [4, 4, 3, null, null] }, { ...NPS, hours: [2, 4, 3, 0, 0.5] }] });
    expect(r.ok && planTotals(r.lines, 5)).toEqual([6, 8, 6, 0, 0.5]);
  });
});

describe("tableau de bord", () => {
  const record = (week: number, stored: "DRAFT" | "VALIDATED" | null, deadline: string, hours = 0) => ({
    week: { year: 2026, week },
    stored,
    deadline: new Date(deadline),
    hours,
    expected: 40,
  });
  const now = new Date("2026-03-19T08:42:00Z");

  it("liste les semaines de la plus récente à la plus ancienne", () => {
    expect(weeksBack({ year: 2026, week: 2 }, { year: 2025, week: 52 })).toEqual([
      { year: 2026, week: 2 }, { year: 2026, week: 1 }, { year: 2025, week: 52 },
    ]);
  });

  it("une semaine manque quand l'échéance est passée sans soumission", () => {
    const records = [
      record(12, "DRAFT", "2026-03-20T17:00:00Z", 24),
      record(11, null, "2026-03-13T17:00:00Z"),
      record(10, "VALIDATED", "2026-03-06T17:00:00Z", 40),
      record(9, "DRAFT", "2026-02-27T17:00:00Z", 12),
    ];
    expect(missingWeeks(records, now).map((r) => r.week.week)).toEqual([11, 9]);
  });

  it("propose Continuer, Saisir ou Consulter", () => {
    expect(actionLabel(historyAction("DRAFT", 24))).toBe("Continuer");
    expect(actionLabel(historyAction("MISSING", 0))).toBe("Saisir");
    expect(actionLabel(historyAction("MISSING", 12))).toBe("Continuer");
    expect(actionLabel(historyAction("REJECTED", 40))).toBe("Continuer");
    expect(actionLabel(historyAction("VALIDATED", 40))).toBe("Consulter");
    expect(todoCount(1)).toBe("1 action");
    expect(todoCount(2)).toBe("2 actions");
  });

  it("écrit la période d'un projet comme la maquette", () => {
    const today = utcDate(2026, 3, 19);
    expect(projectPeriod({ startDate: utcDate(2026, 1, 5), endDate: utcDate(2026, 6, 26) }, today)).toBe("jusqu'au 26 juin 2026");
    expect(projectPeriod({ startDate: utcDate(2026, 1, 1), endDate: utcDate(2026, 12, 31) }, today)).toBe("toute l'année 2026");
    expect(projectPeriod({ startDate: utcDate(2026, 4, 6), endDate: utcDate(2026, 6, 26) }, today)).toBe("débute le 6 avril 2026");
    expect(projectPeriod({ startDate: utcDate(2026, 1, 5), endDate: null }, today)).toBe("depuis le 5 janvier 2026");
    expect(startsShort(utcDate(2026, 4, 6), today)).toBe("Dès le 6 avril");
    expect(startsShort(utcDate(2026, 1, 5), today)).toBeNull();
  });
});
