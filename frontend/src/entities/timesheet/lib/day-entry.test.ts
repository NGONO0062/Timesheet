import { describe, expect, it } from "vitest";
import { utcDate } from "@/shared/lib/iso-week";
import { choiceLabel, dayEntryStatus, daySummary } from "./day-entry";

const DAYS = [16, 17, 18, 19, 20].map((d) => utcDate(2026, 3, d));
const ALL = [1, 1, 1, 1, 1];

describe("saisie par jour", () => {
  it("statut d'une journée : à corriger, faite, à venir, à saisir", () => {
    expect(dayEntryStatus({ value: "a", flagged: true })).toBe("TO_FIX");
    expect(dayEntryStatus({ value: "a" })).toBe("COMPLETE");
    expect(dayEntryStatus({ value: null, isFuture: true })).toBe("UPCOMING");
    expect(dayEntryStatus({ value: null })).toBe("TODO");
  });

  it("dit ce qui manque avant de soumettre", () => {
    const s = daySummary(DAYS, ALL, ["a", "b", "a", null, null]);
    expect(s.filled).toBe(3);
    expect(s.label).toBe("3 sur 5 jours saisis");
    expect(s.check.canSubmit).toBe(false);
    expect(s.check.message).toContain("jeudi 19 et vendredi 20 mars");
  });

  it("une semaine complète peut être soumise", () => {
    expect(daySummary(DAYS, ALL, ["a", "a", "a", "a", "a"]).check.canSubmit).toBe(true);
  });

  it("un jour férié n'attend rien et ne compte pas", () => {
    const s = daySummary(DAYS, [1, 1, 1, 1, 0], ["a", "a", "a", "a", null]);
    expect(s.expected).toBe(4);
    expect(s.check.canSubmit).toBe(true);
  });

  it("libellé d'un choix : projet et activité", () => {
    expect(choiceLabel({ key: "k", project: "Baromètre NPS T1 2026", activity: "Analyse" })).toBe("Baromètre NPS T1 2026 · Analyse");
  });
});
