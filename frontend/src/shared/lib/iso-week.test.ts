import { describe, expect, it } from "vitest";
import {
  compareWeeks, isoWeekOf, isValidIsoWeek, mondayOf, shiftWeek, todayInDivision, utcDate, weeksInIsoYear, workingDaysOf,
} from "./iso-week";

describe("semaines ISO", () => {
  it("la semaine 12 de 2026 va du lundi 16 au vendredi 20 mars", () => {
    expect(isoWeekOf(utcDate(2026, 3, 16))).toEqual({ year: 2026, week: 12 });
    expect(isoWeekOf(utcDate(2026, 3, 22))).toEqual({ year: 2026, week: 12 });
    expect(mondayOf({ year: 2026, week: 12 })).toEqual(utcDate(2026, 3, 16));
  });

  it("gère les semaines qui chevauchent deux années", () => {
    expect(isoWeekOf(utcDate(2026, 1, 1))).toEqual({ year: 2026, week: 1 });
    expect(isoWeekOf(utcDate(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(utcDate(2024, 12, 30))).toEqual({ year: 2025, week: 1 });
    expect(mondayOf({ year: 2025, week: 1 })).toEqual(utcDate(2024, 12, 30));
  });

  it("compte 52 ou 53 semaines", () => {
    expect(weeksInIsoYear(2025)).toBe(52);
    expect(weeksInIsoYear(2026)).toBe(53);
    expect(isValidIsoWeek({ year: 2026, week: 53 })).toBe(true);
    expect(isValidIsoWeek({ year: 2025, week: 53 })).toBe(false);
    expect(isValidIsoWeek({ year: 2026, week: 0 })).toBe(false);
  });

  it("décale d'une semaine en passant l'année", () => {
    expect(shiftWeek({ year: 2026, week: 53 }, 1)).toEqual({ year: 2027, week: 1 });
    expect(shiftWeek({ year: 2026, week: 1 }, -1)).toEqual({ year: 2025, week: 52 });
    expect(compareWeeks({ year: 2026, week: 12 }, { year: 2026, week: 11 })).toBeGreaterThan(0);
  });

  it("liste les jours ouvrés réglés par la division", () => {
    const days = workingDaysOf({ year: 2026, week: 12 }, ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    expect(days).toEqual([16, 17, 18, 19, 20].map((d) => utcDate(2026, 3, d)));
    expect(workingDaysOf({ year: 2026, week: 12 }, ["MONDAY", "SATURDAY"])).toEqual([utcDate(2026, 3, 16), utcDate(2026, 3, 21)]);
  });

  it("donne la date du jour à Douala (UTC+1)", () => {
    expect(todayInDivision(new Date("2026-03-19T23:30:00Z"))).toEqual(utcDate(2026, 3, 20));
    expect(todayInDivision(new Date("2026-03-19T22:59:00Z"))).toEqual(utcDate(2026, 3, 19));
  });
});
