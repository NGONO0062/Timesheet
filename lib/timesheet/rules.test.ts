import { describe, expect, it } from "vitest";
import { NBSP } from "../format";
import { utcDate } from "../iso-week";
import {
  dayStatus, dayTotals, displayStatus, expectedPerDay, overDayMessage, parseHours, submitCheck, weekDeadline,
} from "./rules";
import { isEditable, nextStatus } from "./transitions";

const WEEK12 = [16, 17, 18, 19, 20].map((d) => utcDate(2026, 3, d));
const EXPECTED = expectedPerDay(WEEK12, 8);

describe("lecture d'une cellule", () => {
  it("accepte un nombre positif multiple du pas, virgule ou point", () => {
    expect(parseHours("4", 0.5)).toEqual({ kind: "ok", value: 4 });
    expect(parseHours("3,5", 0.5)).toEqual({ kind: "ok", value: 3.5 });
    expect(parseHours(" 2.5 ", 0.5)).toEqual({ kind: "ok", value: 2.5 });
    expect(parseHours("0", 0.5)).toEqual({ kind: "ok", value: 0 });
    expect(parseHours("", 0.5)).toEqual({ kind: "empty" });
  });

  it("refuse le reste", () => {
    for (const raw of ["-1", "abc", "3,3", "1,25", "25", "2,", ",5", "1e2"]) {
      expect(parseHours(raw, 0.5), raw).toEqual({ kind: "invalid" });
    }
    expect(parseHours("1,25", 0.25)).toEqual({ kind: "ok", value: 1.25 });
  });
});

describe("totaux et statuts des jours", () => {
  it("additionne par jour", () => {
    expect(dayTotals([[4, 4, 3, 0, 0], [2, 4, 3, 0, 0], [2, 0, 2, 0, 0]], 5)).toEqual([8, 8, 8, 0, 0]);
    expect(dayTotals([[0.5, 0.25], [0.25]], 2)).toEqual([0.75, 0.25]);
  });

  it("donne le badge de chaque jour", () => {
    expect(dayStatus({ total: 0, expected: 8 })).toBe("TODO");
    expect(dayStatus({ total: 0, expected: 8, isFuture: true })).toBe("UPCOMING");
    expect(dayStatus({ total: 4, expected: 8 })).toBe("PARTIAL");
    expect(dayStatus({ total: 8, expected: 8 })).toBe("COMPLETE");
    expect(dayStatus({ total: 10, expected: 8 })).toBe("OVER");
    expect(dayStatus({ total: 8, expected: 8, flagged: true })).toBe("TO_FIX");
    expect(dayStatus({ total: 0, expected: 0 })).toBe("COMPLETE");
  });
});

describe("conditions de soumission", () => {
  it("bloque une semaine incomplète et dit ce qui manque", () => {
    const r = submitCheck(WEEK12, [8, 8, 8, 0, 0], EXPECTED);
    expect(r.canSubmit).toBe(false);
    expect(r.message).toBe(`Il reste 16${NBSP}h à saisir : jeudi 19 et vendredi 20 mars.`);
  });

  it("bloque un dépassement en priorité", () => {
    const r = submitCheck(WEEK12, [8, 8, 10, 0, 0], EXPECTED);
    expect(r.canSubmit).toBe(false);
    expect(r.message).toBe(`Plafond de 8${NBSP}h dépassé : mercredi 18 mars. Corrigez avant de soumettre.`);
  });

  it("autorise une semaine complète", () => {
    expect(submitCheck(WEEK12, [8, 8, 8, 8, 8], EXPECTED)).toEqual({
      canSubmit: true,
      message: "La semaine est complète. Vous pouvez la soumettre.",
    });
  });

  it("attend 0 h un jour férié", () => {
    const expected = expectedPerDay(WEEK12, 8, [utcDate(2026, 3, 20)]);
    expect(expected).toEqual([8, 8, 8, 8, 0]);
    expect(submitCheck(WEEK12, [8, 8, 8, 8, 0], expected).canSubmit).toBe(true);
  });

  it("explique un dépassement sous la grille", () => {
    expect(overDayMessage(utcDate(2026, 3, 18), 10, 8)).toBe(
      `Mercredi 18 mars : 10${NBSP}h saisies pour 8${NBSP}h attendues. Retirez 2${NBSP}h avant de soumettre.`,
    );
  });
});

describe("échéance et statut calculé « Manquante »", () => {
  const rules = { deadlineDay: "FRIDAY", deadlineTime: "18:00" } as const;

  it("place l'échéance le vendredi à 18:00, heure de Douala", () => {
    expect(weekDeadline({ year: 2026, week: 12 }, rules)).toEqual(new Date("2026-03-20T17:00:00Z"));
    expect(weekDeadline({ year: 2026, week: 12 }, { deadlineDay: "MONDAY", deadlineTime: "09:00" })).toEqual(
      new Date("2026-03-23T08:00:00Z"),
    );
  });

  it("calcule « Manquante » sans la stocker", () => {
    const deadline = weekDeadline({ year: 2026, week: 11 }, rules);
    const after = new Date("2026-03-16T08:00:00Z");
    const before = new Date("2026-03-12T08:00:00Z");
    expect(displayStatus(null, deadline, after)).toBe("MISSING");
    expect(displayStatus("DRAFT", deadline, after)).toBe("MISSING");
    expect(displayStatus("DRAFT", deadline, before)).toBe("DRAFT");
    expect(displayStatus("SUBMITTED", deadline, after)).toBe("SUBMITTED");
    expect(displayStatus("REJECTED", deadline, after)).toBe("REJECTED");
  });
});

describe("transitions de statut", () => {
  it("suit le circuit brouillon → soumise → validée ou rejetée", () => {
    expect(nextStatus("DRAFT", "SUBMIT")).toBe("SUBMITTED");
    expect(nextStatus("SUBMITTED", "VALIDATE")).toBe("VALIDATED");
    expect(nextStatus("SUBMITTED", "REJECT")).toBe("REJECTED");
    expect(nextStatus("REJECTED", "SUBMIT")).toBe("SUBMITTED");
  });

  it("refuse les transitions impossibles", () => {
    expect(nextStatus("DRAFT", "VALIDATE")).toBeNull();
    expect(nextStatus("VALIDATED", "REJECT")).toBeNull();
    expect(nextStatus("SUBMITTED", "SUBMIT")).toBeNull();
  });

  it("verrouille selon la règle de la division", () => {
    expect(isEditable("DRAFT", true)).toBe(true);
    expect(isEditable("REJECTED", true)).toBe(true);
    expect(isEditable("SUBMITTED", true)).toBe(false);
    expect(isEditable("VALIDATED", true)).toBe(false);
    expect(isEditable("VALIDATED", false)).toBe(true);
  });
});
