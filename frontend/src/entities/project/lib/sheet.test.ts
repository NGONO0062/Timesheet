import { describe, expect, it } from "vitest";
import { NBSP } from "@/shared/lib/format";
import { attentionText, attentionTone, budgetDetail, budgetValue, shareOf, sheetTrendColumns, tasksByColumn, tasksValue } from "./sheet";

const sp = (text: string) => text.replaceAll(NBSP, " ");
const project = { budget: 30, consumed: 33, budgetPercent: 110, elapsedPercent: 50, start: "2026-01-01", end: "2026-04-10", lastDay: "2026-01-29" };

describe("fiche projet : règles d'affichage", () => {
  it("écrit chaque point d'attention avec les chiffres du projet", () => {
    expect(sp(attentionText("overBudget", project))).toBe("Budget dépassé de 3 jours : 33 jours consommés pour 30 jours prévus.");
    expect(sp(attentionText("endPassed", project))).toBe("Date de fin dépassée depuis le 10 avril 2026 : le projet est encore en cours.");
    expect(sp(attentionText("budgetAhead", { ...project, budgetPercent: 70 }))).toBe("Le budget se consomme plus vite que le délai : 70 % du budget pour 50 % du délai écoulé.");
    expect(sp(attentionText("quiet", project))).toBe("Aucune journée saisie sur ce projet depuis le 29 janvier 2026.");
    expect(sp(attentionText("quiet", { ...project, lastDay: null }))).toBe("Aucune journée saisie sur ce projet depuis son début, le 1 janvier 2026.");
  });

  it("classe le dépassement de budget en erreur, le reste en avertissement", () => {
    expect(attentionTone("overBudget")).toBe("danger");
    expect((["endPassed", "budgetAhead", "quiet"] as const).map(attentionTone)).toEqual(["warning", "warning", "warning"]);
  });

  it("donne le budget, sa part consommée, le reste ou le dépassement", () => {
    expect(sp(budgetValue(12, 30))).toBe("12 / 30 jours");
    expect(sp(budgetValue(12, null))).toBe("12 jours");
    expect(sp(budgetDetail(12, 30, 40))).toBe("40 % du budget · reste 18 jours");
    expect(sp(budgetDetail(33, 30, 110))).toBe("110 % du budget · dépassé de 3 jours");
    expect(budgetDetail(12, null, null)).toBe("Sans budget : le consommé ne se compare à rien.");
  });

  it("calcule une part sans diviser par zéro", () => {
    expect(shareOf(2, 3)).toBe(67);
    expect(shareOf(0, 0)).toBe(0);
  });

  it("résume les tâches et les donne par colonne du tableau", () => {
    const tasks = { backlog: 1, todo: 2, inProgress: 3, review: 0, done: 4, total: 10 };
    expect(tasksValue(tasks)).toBe("4 sur 10 terminées");
    expect(tasksValue({ ...tasks, done: 1 })).toBe("1 sur 10 terminée");
    expect(tasksValue({ backlog: 0, todo: 0, inProgress: 0, review: 0, done: 0, total: 0 })).toBe("Aucune tâche");
    expect(tasksByColumn(tasks).map((c) => `${c.label} ${c.count}`)).toEqual(["Backlog 1", "À faire 2", "En cours 3", "En revue 0", "Terminée 4"]);
  });

  it("met la tendance à l'échelle de la plus haute semaine, la semaine en cours évidée", () => {
    const weeks = [
      { year: 2026, week: 10, monday: "2026-03-02", days: 4 },
      { year: 2026, week: 11, monday: "2026-03-09", days: 2 },
      { year: 2026, week: 12, monday: "2026-03-16", days: 0 },
    ];
    const columns = sheetTrendColumns(weeks);
    expect(columns.map((c) => c.height)).toEqual([160, 80, 0]);
    expect(columns.map((c) => c.open)).toEqual([false, false, true]);
    expect(columns.map((c) => c.label)).toEqual(["S10", "S11", "S12"]);
    expect(sp(columns[0]?.title ?? "")).toBe("Semaine 10 : 4 jours");
    expect(sp(columns[2]?.title ?? "")).toBe("Semaine 12, en cours : 0 jour");
    // Aucune journée sur la période : pas de division par zéro.
    expect(sheetTrendColumns(weeks.map((w) => ({ ...w, days: 0 }))).map((c) => c.height)).toEqual([0, 0, 0]);
  });
});
