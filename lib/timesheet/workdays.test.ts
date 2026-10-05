import { describe, expect, it } from "vitest";
import { utcDate } from "../iso-week";
import { addWorkingDays, isWorkingDay, reminderDue } from "./workdays";

const WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

describe("jours ouvrés", () => {
  it("saute le week-end et les jours fériés", () => {
    expect(isWorkingDay(utcDate(2026, 3, 21), WEEK)).toBe(false); // samedi
    expect(isWorkingDay(utcDate(2026, 3, 20), WEEK)).toBe(true);
    expect(addWorkingDays(utcDate(2026, 3, 20), 3, WEEK)).toEqual(utcDate(2026, 3, 25)); // ven. → mer.
    expect(addWorkingDays(utcDate(2026, 3, 20), 3, WEEK, [utcDate(2026, 3, 23)])).toEqual(utcDate(2026, 3, 26));
  });

  it("relance après 3 jours ouvrés révolus, une fois par soumission", () => {
    const base = { submittedDay: utcDate(2026, 3, 20), afterDays: 3, workingDays: WEEK, alreadyReminded: false };
    expect(reminderDue({ ...base, today: utcDate(2026, 3, 25) })).toBe(false);
    expect(reminderDue({ ...base, today: utcDate(2026, 3, 26) })).toBe(true);
    expect(reminderDue({ ...base, today: utcDate(2026, 3, 26), alreadyReminded: true })).toBe(false);
    expect(reminderDue({ ...base, afterDays: 2, today: utcDate(2026, 3, 25) })).toBe(true);
  });
});
