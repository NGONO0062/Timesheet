import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/http";
import type { Matrix } from "../api/types";
import { adminMessage, fieldMessages, holidaysOfYear, holidayYears, isLocked, ruleOf, toggleMatrix } from "./rules";

const matrix: Matrix = {
  STAFF: ["ENTER_TIME"],
  MANAGER: ["ENTER_TIME", "VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING"],
  OWNER: ["VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING", "VIEW_DIVISION"],
  DIVISION_ADMIN: ["MANAGE_PROJECTS", "VIEW_REPORTING", "VIEW_DIVISION", "ADMINISTER_DIVISION"],
};

describe("jours fériés", () => {
  const rows = [
    { id: "b", date: "2026-05-01", label: "Fête du Travail" },
    { id: "c", date: "2027-01-01", label: "Jour de l'An" },
    { id: "a", date: "2026-01-01", label: "Jour de l'An" },
  ];

  it("ne garde que l'année affichée, dans l'ordre des dates", () => {
    expect(holidaysOfYear(rows, 2026).map((h) => h.id)).toEqual(["a", "b"]);
    expect(holidaysOfYear(rows, 2027).map((h) => h.id)).toEqual(["c"]);
    expect(holidaysOfYear(rows, 2028)).toEqual([]);
  });

  it("propose les années de l'API, et l'année affichée même vidée", () => {
    expect(holidayYears([2026, 2027], 2026)).toEqual([2026, 2027]);
    expect(holidayYears([2026, 2027], 2029)).toEqual([2026, 2027, 2029]);
  });

  it("a un message pour chaque refus de l'API", () => {
    for (const code of ["holidayDate", "holidayLabel", "holidayTaken", "holidayNotFound"]) expect(adminMessage(code)).not.toBe(adminMessage("unknown"));
  });
});

describe("administration de division : règles d'affichage", () => {
  it("coche une permission dans l'ordre de la planche, et la retire", () => {
    expect(toggleMatrix(matrix, "STAFF", "VIEW_REPORTING", true).STAFF).toEqual(["ENTER_TIME", "VIEW_REPORTING"]);
    expect(toggleMatrix(matrix, "MANAGER", "ENTER_TIME", false).MANAGER).toEqual(["VALIDATE_TEAM", "MANAGE_PROJECTS", "VIEW_REPORTING"]);
    expect(isLocked("DIVISION_ADMIN", "ADMINISTER_DIVISION")).toBe(true);
    expect(isLocked("OWNER", "ADMINISTER_DIVISION")).toBe(false);
  });

  it("traduit les champs et les codes de l'API", () => {
    expect(fieldMessages(["firstName", "emailTaken"])).toEqual({ firstName: "Saisissez le prénom.", email: "Un compte existe déjà avec cette adresse." });
    expect(adminMessage("lastAdmin")).toBe("La division doit garder au moins un administrateur actif.");
    expect(adminMessage("inconnu")).toBe("L'enregistrement n'a pas abouti. Vos modifications sont conservées : réessayez.");
    expect(ruleOf(new ApiError(422, { code: "invalid", fields: ["threshold"] }))).toEqual({ code: "invalid", fields: ["threshold"] });
    expect(ruleOf(new ApiError(401, null)).code).toBe("session");
    expect(ruleOf(new Error("x")).code).toBe("unknown");
  });
});
