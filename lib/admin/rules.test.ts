import { describe, expect, it } from "vitest";
import { DEFAULT_MATRIX } from "../permissions";
import { checkNewPassword, checkRules, checkUser, checkWorkflow, describeRules, matrixOf, overridesFor, pageOf, parseNumber, type RulesInput } from "./rules";

const rules: RulesInput = {
  unit: "HOURS",
  workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  hoursPerDay: "8",
  step: 0.5,
  deadlineDay: "FRIDAY",
  deadlineTime: "18:00",
  fillAlertThreshold: "80",
  allowFutureWeeks: false,
  lockAfterValidation: true,
};

describe("matrice des permissions", () => {
  it("part de la matrice par défaut et n'enregistre que les écarts", () => {
    const m = matrixOf([]);
    expect(m.STAFF).toEqual(["ENTER_TIME"]);
    expect(overridesFor(m)).toEqual([]);
    const changed = { ...m, STAFF: [...m.STAFF, "VIEW_REPORTING" as const], OWNER: m.OWNER.filter((p) => p !== "VIEW_DIVISION") };
    expect(overridesFor(changed)).toEqual([
      { role: "STAFF", permission: "VIEW_REPORTING", granted: true },
      { role: "OWNER", permission: "VIEW_DIVISION", granted: false },
    ]);
    expect(matrixOf(overridesFor(changed))).toEqual(changed);
  });

  it("garde la dernière permission de l'admin de division, même retirée", () => {
    const m = matrixOf([{ role: "DIVISION_ADMIN", permission: "ADMINISTER_DIVISION", granted: false }]);
    expect(m.DIVISION_ADMIN).toContain("ADMINISTER_DIVISION");
    const without = { ...m, DIVISION_ADMIN: m.DIVISION_ADMIN.filter((p) => p !== "ADMINISTER_DIVISION") };
    expect(overridesFor(without)).toEqual([]);
    expect(matrixOf(overridesFor(without)).DIVISION_ADMIN).toEqual([...DEFAULT_MATRIX.DIVISION_ADMIN]);
  });
});

describe("règles de saisie", () => {
  it("accepte les valeurs par défaut", () => {
    expect(checkRules(rules)).toEqual({});
  });

  it("lit les nombres à la française", () => {
    expect(parseNumber("7,5")).toBe(7.5);
    expect(parseNumber(" 8 ")).toBe(8);
    expect(parseNumber("8h")).toBeNull();
    expect(checkRules({ ...rules, hoursPerDay: "7,5" })).toEqual({});
  });

  it("refuse chaque champ hors limites", () => {
    const e = checkRules({ ...rules, workingDays: [], hoursPerDay: "7,3", step: 0.3, deadlineTime: "25:00", fillAlertThreshold: "101" });
    expect(Object.keys(e).sort()).toEqual(["deadline", "hoursPerDay", "step", "threshold", "workingDays"]);
    expect(checkRules({ ...rules, hoursPerDay: "0" }).hoursPerDay).toBeDefined();
    expect(checkRules({ ...rules, deadlineDay: "SUNDAY" }).deadline).toBeDefined();
    expect(checkRules({ ...rules, fillAlertThreshold: "79,5" }).threshold).toBeDefined();
  });
});

describe("workflow", () => {
  const w = { ownerValidation: false, hrAutoSend: true, hrEmail: "rh@exemple.com", reminderAfterWorkingDays: 3, delegateToOwner: true };
  it("exige l'adresse des RH et un délai de 2, 3 ou 5 jours", () => {
    expect(checkWorkflow(w)).toEqual({});
    expect(checkWorkflow({ ...w, hrEmail: "" }).hrEmail).toBe("Saisissez l'adresse e-mail des RH, au format nom@domaine.cm.");
    expect(checkWorkflow({ ...w, reminderAfterWorkingDays: 4 }).reminder).toBeDefined();
  });
});

describe("utilisateurs", () => {
  const u = { email: "a@exemple.com", firstName: "Aïcha", lastName: "Ndongo", role: "STAFF" as const, managerId: "m1" };
  it("contrôle l'adresse, les noms, le rôle et le manager", () => {
    expect(checkUser(u, ["m1"])).toEqual({});
    expect(Object.keys(checkUser({ ...u, email: "a@", firstName: " ", lastName: "", managerId: "m2" }, ["m1"])).sort()).toEqual(["email", "firstName", "lastName", "manager"]);
    expect(checkUser({ ...u, managerId: null }, [])).toEqual({});
  });

  it("pagine par 5 : « Utilisateurs 1 à 5 sur 21 »", () => {
    expect(pageOf(21, 1)).toEqual({ page: 1, count: 5, from: 1, to: 5, skip: 0 });
    expect(pageOf(21, 5)).toEqual({ page: 5, count: 5, from: 21, to: 21, skip: 20 });
    expect(pageOf(21, 9).page).toBe(5);
    expect(pageOf(21, Number.NaN).page).toBe(1);
    expect(pageOf(0, 1)).toEqual({ page: 1, count: 1, from: 0, to: 0, skip: 0 });
  });
});

describe("mot de passe", () => {
  it("demande 12 caractères, une lettre, un chiffre, et une confirmation identique", () => {
    expect(checkNewPassword("Orange-Cameroun-2026", "Orange-Cameroun-2026")).toBeNull();
    expect(checkNewPassword("court1", "court1")?.field).toBe("next");
    expect(checkNewPassword("sanschiffre-ici", "sanschiffre-ici")?.field).toBe("next");
    expect(checkNewPassword("Orange-Cameroun-2026", "Orange-Cameroun-2025")?.field).toBe("confirm");
  });
});

describe("journal des règles", () => {
  it("écrit ce qui a changé, comme la planche 13", () => {
    expect(describeRules(rules, { ...rules, fillAlertThreshold: "80" })).toEqual([]);
    expect(describeRules({ ...rules, fillAlertThreshold: "75" }, rules)).toEqual(["Seuil d'alerte de remplissage : 80 %"]);
    expect(describeRules(rules, { ...rules, hoursPerDay: "7", step: 1, allowFutureWeeks: true })).toEqual([
      "Heures attendues par jour : 7 h",
      "Pas de saisie : 1 h",
      "Autoriser la saisie des semaines futures : Actif",
    ]);
  });
});
