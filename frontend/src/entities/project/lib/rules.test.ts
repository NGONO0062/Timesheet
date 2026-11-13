import { describe, expect, it } from "vitest";
import { NBSP } from "@/shared/lib/format";
import { acceptsTimeEntry, budgetUsage, checkProjectForm, compareProjects, consumedText, fieldErrors, projectPeriodLabel, projectSummary, statusChangedMessage } from "./rules";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("statut d'un projet", () => {
  it("n'ouvre la saisie qu'aux projets « En cours » et le dit dans le message", () => {
    expect(acceptsTimeEntry("IN_PROGRESS")).toBe(true);
    expect(acceptsTimeEntry("ON_HOLD")).toBe(false);
    expect(statusChangedMessage("Refonte FAQ en ligne", "IN_PROGRESS")).toBe(
      "« Refonte FAQ en ligne » est passé à « En cours ». Ses membres peuvent y saisir leurs journées.",
    );
    expect(statusChangedMessage("Refonte FAQ en ligne", "ON_HOLD")).toBe("« Refonte FAQ en ligne » est passé à « En pause ». La saisie des temps y est fermée.");
  });
});

describe("budget et tri", () => {
  it("écrit le dépassement de budget, sans étiquette", () => {
    expect(budgetUsage(296, 320)).toEqual({ percent: 93, overText: null });
    expect(budgetUsage(410, 400)).toEqual({ percent: 103, overText: `Budget dépassé de 10${NBSP}jours` });
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

describe("écran Projets", () => {
  it("écrit la période, les jours consommés et le résumé comme la maquette", () => {
    expect(projectPeriodLabel(d(2026, 1, 5), d(2026, 6, 26))).toBe("5 janv. – 26 juin 2026");
    expect(projectPeriodLabel(d(2026, 1, 1), d(2026, 12, 31))).toBe("Toute l'année 2026");
    expect(projectPeriodLabel(d(2026, 1, 5), null)).toBe("Depuis le 5 janvier 2026");
    expect(consumedText(612, 960)).toBe(`612 / 960${NBSP}jours · 64${NBSP}%`);
    expect(consumedText(148, null)).toBe(`148${NBSP}jours · sans budget`);
    expect(projectSummary(7, 4)).toBe("7 projets · 4 en cours");
    expect(projectSummary(1, 0)).toBe("1 projet · 0 en cours");
  });

  it("contrôle le panneau de création et prépare le corps de la requête", () => {
    const base = { name: "Audit parcours réclamation", start: "06/04/2026", end: "26/06/2026", status: "NOT_STARTED" as const, budget: "320", activities: ["Analyse", " Atelier ", "Analyse"], memberIds: ["a", "a"] };
    const ok = checkProjectForm(base);
    expect(ok.ok && ok.value).toEqual({ name: "Audit parcours réclamation", start: "2026-04-06", end: "2026-06-26", status: "NOT_STARTED", budget: 320, activities: ["Analyse", "Atelier"], memberIds: ["a"] });
    expect(checkProjectForm({ ...base, budget: "", end: "" })).toMatchObject({ ok: true, value: { budget: null, end: null } });
    const bad = checkProjectForm({ ...base, name: " ", start: "31/02/2026", budget: "3,5", activities: [] });
    expect(bad.ok ? null : Object.keys(bad.errors).sort()).toEqual(["activities", "budget", "name", "start"]);
    const endBefore = checkProjectForm({ ...base, end: "01/04/2026" });
    expect(endBefore.ok ? null : endBefore.errors.end).toBe("Saisissez une date de fin au format jj/mm/aaaa, après la date de début.");
  });

  it("traduit les champs refusés par l'API", () => {
    expect(fieldErrors(["name", "status", "activities"])).toEqual({ name: "Saisissez le nom du projet.", activities: "Ajoutez au moins une activité." });
  });
});
