import { describe, expect, it } from "vitest";
import { NBSP } from "../format";
import { dict } from "../i18n";
import { utcDate } from "../iso-week";
import { DEFAULT_MATRIX, effectivePermissions, isLocked } from "../permissions";
import {
  acceptsTimeEntry, budgetUsage, canAddLine, canRecordHours, compareProjects, endDatePassed, entryNotice, statusChangedMessage,
} from "./rules";

const WEEK12 = { weekStart: utcDate(2026, 3, 16), weekEnd: utcDate(2026, 3, 20) };
const REFONTE = { startDate: utcDate(2026, 1, 5), endDate: utcDate(2026, 6, 30) };

describe("saisie selon le statut du projet", () => {
  it("n'accepte de nouvelles heures que sur un projet « En cours »", () => {
    expect(acceptsTimeEntry("IN_PROGRESS")).toBe(true);
    for (const s of ["NOT_STARTED", "ON_HOLD", "DONE"] as const) {
      expect(acceptsTimeEntry(s)).toBe(false);
      expect(canRecordHours(s)).toBe(false);
    }
  });

  it("n'ajoute une ligne que pour un membre, un projet en cours et une période qui couvre la semaine", () => {
    expect(canAddLine({ status: "IN_PROGRESS", isMember: true, project: REFONTE, ...WEEK12 })).toBe(true);
    expect(canAddLine({ status: "IN_PROGRESS", isMember: false, project: REFONTE, ...WEEK12 })).toBe(false);
    expect(canAddLine({ status: "ON_HOLD", isMember: true, project: REFONTE, ...WEEK12 })).toBe(false);
    // Enquête boutiques T2 2026 : début le 6 avril.
    const enquete = { startDate: utcDate(2026, 4, 6), endDate: utcDate(2026, 6, 26) };
    expect(canAddLine({ status: "IN_PROGRESS", isMember: true, project: enquete, ...WEEK12 })).toBe(false);
    expect(canAddLine({ status: "IN_PROGRESS", isMember: true, project: { startDate: utcDate(2026, 1, 1), endDate: null }, ...WEEK12 })).toBe(true);
  });

  it("remplace les heures par un texte quand la saisie n'est pas ouverte", () => {
    expect(entryNotice("IN_PROGRESS")).toBeNull();
    expect(entryNotice("NOT_STARTED")).toBe("Saisie pas encore ouverte");
    expect(entryNotice("ON_HOLD")).toBe("Saisie fermée");
    expect(entryNotice("DONE")).toBe("Saisie fermée");
  });
});

describe("changement de statut", () => {
  it("dit le nouveau statut et l'effet sur la saisie", () => {
    expect(statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")).toBe(
      "« Refonte FAQ en ligne » est passé à « En cours ». Ses membres peuvent y saisir des heures.",
    );
    expect(statusChangedMessage("Refonte FAQ en ligne", "ON_HOLD")).toBe(
      "« Refonte FAQ en ligne » est passé à « En pause ». La saisie des temps y est fermée.",
    );
  });

  it("signale une date de fin dépassée sans changer le statut", () => {
    const today = utcDate(2026, 3, 19);
    expect(endDatePassed("IN_PROGRESS", utcDate(2026, 3, 13), today)).toBe(true);
    expect(endDatePassed("IN_PROGRESS", utcDate(2026, 3, 19), today)).toBe(false);
    expect(endDatePassed("DONE", utcDate(2026, 2, 27), today)).toBe(false);
    expect(endDatePassed("IN_PROGRESS", null, today)).toBe(false);
  });
});

describe("budget et tri", () => {
  it("écrit le dépassement de budget, sans étiquette", () => {
    expect(budgetUsage(296, 320)).toEqual({ percent: 93, overText: null });
    expect(budgetUsage(410, 400)).toEqual({ percent: 103, overText: `Budget dépassé de 10${NBSP}h` });
    expect(budgetUsage(120, null)).toBeNull();
  });

  it("trie par statut puis par code", () => {
    const list = [
      { status: "DONE", code: "CX-2026-04" },
      { status: "NOT_STARTED", code: "CX-2026-06" },
      { status: "IN_PROGRESS", code: "CX-2026-02" },
      { status: "ON_HOLD", code: "CX-2026-05" },
      { status: "IN_PROGRESS", code: "CX-2026-00" },
    ] as const;
    expect([...list].sort(compareProjects).map((p) => p.code)).toEqual(["CX-2026-00", "CX-2026-02", "CX-2026-06", "CX-2026-05", "CX-2026-04"]);
  });
});

describe("permissions", () => {
  it("porte le nouveau libellé de la permission projets", () => {
    expect(dict.permissions.MANAGE_PROJECTS).toBe("Gérer les projets : création, statut, membres");
  });

  it("donne « Gérer les projets » au manager, à l'owner et à l'admin de division, pas au staff", () => {
    expect(effectivePermissions("MANAGER").has("MANAGE_PROJECTS")).toBe(true);
    expect(effectivePermissions("OWNER").has("MANAGE_PROJECTS")).toBe(true);
    expect(effectivePermissions("DIVISION_ADMIN").has("MANAGE_PROJECTS")).toBe(true);
    expect(effectivePermissions("STAFF").has("MANAGE_PROJECTS")).toBe(false);
    expect(effectivePermissions("PLATFORM_ADMIN").size).toBe(0);
  });

  it("applique les réglages de la division sans retirer la permission verrouillée", () => {
    const p = effectivePermissions("MANAGER", [
      { role: "MANAGER", permission: "MANAGE_PROJECTS", granted: false },
      { role: "STAFF", permission: "VIEW_REPORTING", granted: true },
    ]);
    expect(p.has("MANAGE_PROJECTS")).toBe(false);
    expect(p.has("VIEW_REPORTING")).toBe(true);
    const admin = effectivePermissions("DIVISION_ADMIN", [{ role: "DIVISION_ADMIN", permission: "ADMINISTER_DIVISION", granted: false }]);
    expect(admin.has("ADMINISTER_DIVISION")).toBe(true);
    expect(isLocked("DIVISION_ADMIN", "ADMINISTER_DIVISION")).toBe(true);
  });

  it("reprend la matrice de la planche 12", () => {
    expect(DEFAULT_MATRIX.STAFF).toEqual(["ENTER_TIME"]);
    expect(DEFAULT_MATRIX.OWNER).not.toContain("ENTER_TIME");
  });
});
