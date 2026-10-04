import { describe, expect, it } from "vitest";
import { formatDateTime, formatDayList, formatHours, formatHoursOf, formatNumber, formatPercent, formatRange, formatTime, NBSP } from "./format";
import { utcDate } from "./iso-week";

describe("formats", () => {
  it("écrit les nombres avec la virgule décimale", () => {
    expect(formatNumber(4)).toBe("4");
    expect(formatNumber(0.5)).toBe("0,5");
    expect(formatNumber(3.25)).toBe("3,25");
  });

  it("met une espace insécable avant h et %", () => {
    expect(formatHours(8)).toBe(`8${NBSP}h`);
    expect(formatPercent(0.833)).toBe(`83${NBSP}%`);
    expect(formatHoursOf(24, 40)).toBe(`24 / 40${NBSP}h`);
  });

  it("écrit les intervalles comme la maquette", () => {
    expect(formatRange(utcDate(2026, 3, 16), utcDate(2026, 3, 20))).toBe("16–20 mars 2026");
    expect(formatRange(utcDate(2026, 9, 28), utcDate(2026, 10, 2))).toBe("28 sept. – 2 oct. 2026");
    expect(formatRange(utcDate(2026, 2, 23), utcDate(2026, 2, 27), false)).toBe("23–27 févr.");
    expect(formatRange(utcDate(2025, 12, 29), utcDate(2026, 1, 2))).toBe("29 déc. 2025 – 2 janv. 2026");
  });

  it("affiche l'heure de Douala sur 24 h", () => {
    const instant = new Date("2026-03-20T15:42:00Z");
    expect(formatDateTime(instant)).toBe("20 mars 2026, 16:42");
    expect(formatTime(instant)).toBe("16:42");
  });

  it("groupe les jours par mois", () => {
    expect(formatDayList([utcDate(2026, 3, 19), utcDate(2026, 3, 20)])).toBe("jeudi 19 et vendredi 20 mars");
    expect(formatDayList([utcDate(2026, 2, 27), utcDate(2026, 3, 2)])).toBe("vendredi 27 février et lundi 2 mars");
    expect(formatDayList([utcDate(2026, 3, 16), utcDate(2026, 3, 17), utcDate(2026, 3, 18)])).toBe("lundi 16, mardi 17 et mercredi 18 mars");
  });
});
