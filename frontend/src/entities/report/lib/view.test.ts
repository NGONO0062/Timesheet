import { describe, expect, it } from "vitest";
import { NBSP } from "@/shared/lib/format";
import type { Report } from "../api/types";
import { buildReportView, formatShare, kpiTexts, weekChoices } from "./view";

const report: Report = {
  current: { year: 2026, week: 12 },
  axis: "project",
  from: { year: 2026, week: 11 },
  to: { year: 2026, week: 12 },
  personId: null,
  whole: false,
  people: [
    { id: "a", name: "Ana", team: null },
    { id: "b", name: "Ben", team: null },
  ],
  weeks: [
    { year: 2026, week: 11, monday: "2026-03-09", capacity: 5, open: false },
    { year: 2026, week: 12, monday: "2026-03-16", capacity: 5, open: true },
  ],
  kpis: { entered: 12, capacity: 20, persons: 2, weeks: 2, missingDays: 8, missingSheets: 1, validated: 2, pending: 1, expectedSheets: 4 },
  series: [
    { key: "p1", label: "Refonte", index: 0, keys: ["p1"] },
    { key: "p2", label: "Baromètre", index: 1, keys: ["p2"] },
  ],
  entities: [
    { key: "p1", label: "Refonte", sub: "CX-01", count: 4, byWeek: [5, 3], total: 8, series: 0 },
    { key: "p2", label: "Baromètre", sub: "CX-02", count: 3, byWeek: [2, 2], total: 4, series: 1 },
  ],
};

describe("écran Reporting", () => {
  it("propose les douze dernières semaines", () => {
    const choices = weekChoices({ year: 2026, week: 12 });
    expect(choices).toHaveLength(12);
    expect(choices[0]).toEqual({ key: "2026-12", label: "S12 · 16–20 mars 2026" });
  });

  it("écrit les indicateurs comme la maquette", () => {
    expect(kpiTexts(report.kpis)).toEqual({
      entered: `12${NBSP}jours`,
      capacity: `sur 20${NBSP}jours de capacité (2 personnes, 2 semaines)`,
      fill: `60${NBSP}%`,
      fillDetail: `Non saisi : 8${NBSP}jours : 1 fiche manquante`,
      validated: "2 sur 4",
      validatedDetail: "1 en attente de validation, 1 manquante",
    });
    expect(formatShare(268, 640)).toBe(`41,9${NBSP}%`);
    expect(formatShare(640, 640)).toBe(`100${NBSP}%`);
  });

  it("prépare barres, colonnes empilées et tableau", () => {
    const view = buildReportView(report);
    expect(view.period).toBe("Du 9 au 20 mars 2026");
    expect(view.bars.map((b) => [b.label, b.width, b.series])).toEqual([
      ["Refonte", 100, 0],
      ["Baromètre", 50, 1],
    ]);
    expect(view.columns.map((c) => [c.label, c.open, c.height])).toEqual([
      ["S11", false, 160],
      ["S12 · en cours", true, 114],
    ]);
    expect(view.table.rows[0]).toMatchObject({ label: "Refonte", total: `8${NBSP}jours`, share: `66,7${NBSP}%` });
    expect(view.table.foot.total).toBe(`12${NBSP}jours`);
    expect(view.capacityNote).toBe(`Capacité : 10${NBSP}jours par semaine. Colonne évidée : semaine dont la validation est en cours.`);
  });
});
