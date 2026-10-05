import { describe, expect, it } from "vitest";
import { parseTab, periodOptions, plural, submissionTag, weeksOfMonth } from "./queue";
import { dict } from "../i18n";

describe("file de validation", () => {
  it("propose les périodes de la maquette", () => {
    const options = periodOptions({ year: 2026, week: 12 });
    expect(options.map((o) => o.label)).toEqual([
      "4 dernières semaines (S9 à S12)",
      "Semaine 12 · 16–20 mars 2026",
      "Semaine 11 · 9–13 mars 2026",
      "Semaine 10 · 2–6 mars 2026",
      "Semaine 9 · 23–27 février 2026",
      "Mars 2026",
      "Février 2026",
      "Toutes les périodes",
    ]);
    expect(options[0]!.weeks).toEqual([12, 11, 10, 9].map((week) => ({ year: 2026, week })));
    expect(options.at(-1)!.weeks).toBeNull();
  });

  it("rattache une semaine au mois de son lundi", () => {
    expect(weeksOfMonth(2026, 2).map((w) => w.week)).toEqual([10, 11, 12, 13, 14]); // lundis 2, 9, 16, 23, 30 mars
    expect(weeksOfMonth(2025, 11).at(-1)).toEqual({ year: 2026, week: 1 }); // lundi 29 décembre 2025
  });

  it("lit l'onglet, écrit les comptes et la nouvelle soumission", () => {
    expect(parseTab("VALIDATED")).toBe("VALIDATED");
    expect(parseTab("n'importe quoi")).toBe("SUBMITTED");
    expect(submissionTag(1)).toBeNull();
    expect(submissionTag(2)).toBe("2e soumission");
    expect(plural(1, dict.validation.selectedOne, dict.validation.selectedMany)).toBe("1 fiche sélectionnée");
    expect(plural(2, dict.validation.selectedOne, dict.validation.selectedMany)).toBe("2 fiches sélectionnées");
  });
});
