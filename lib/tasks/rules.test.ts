import { describe, expect, it } from "vitest";
import { bottomPosition, boardEditable, checkTaskTitle, columnLabel, columnOf, isTaskStatus, movedMessage, moveLocally, readOnlyReason, TASK_TITLE_MAX } from "./rules";

describe("titre d'une tâche", () => {
  it("retire les espaces superflus", () => {
    expect(checkTaskTitle("  Maquette   de la  page  ")).toEqual({ ok: true, value: "Maquette de la page" });
  });

  it("refuse un titre vide ou trop long", () => {
    expect(checkTaskTitle("   ")).toEqual({ ok: false, error: "Saisissez le titre de la tâche." });
    expect(checkTaskTitle("a".repeat(TASK_TITLE_MAX)).ok).toBe(true);
    expect(checkTaskTitle("a".repeat(TASK_TITLE_MAX + 1))).toEqual({ ok: false, error: "Le titre tient en 140 caractères au plus." });
  });
});

describe("tableau en lecture seule", () => {
  it("ferme le tableau d'un projet terminé ou archivé", () => {
    expect(boardEditable({ status: "IN_PROGRESS", archived: false })).toBe(true);
    expect(boardEditable({ status: "NOT_STARTED", archived: false })).toBe(true);
    expect(boardEditable({ status: "ON_HOLD", archived: false })).toBe(true);
    expect(boardEditable({ status: "DONE", archived: false })).toBe(false);
    expect(boardEditable({ status: "IN_PROGRESS", archived: true })).toBe(false);
    expect(readOnlyReason({ status: "DONE", archived: false })).toBe("Projet terminé : son tableau reste lisible, en lecture seule.");
    expect(readOnlyReason({ status: "IN_PROGRESS", archived: false })).toBeNull();
  });
});

describe("colonnes et déplacements", () => {
  const tasks = [
    { id: "a", status: "TODO" as const, position: 1 },
    { id: "b", status: "TODO" as const, position: 0 },
    { id: "c", status: "IN_PROGRESS" as const, position: 4 },
  ];

  it("range une colonne de haut en bas", () => {
    expect(columnOf(tasks, "TODO").map((x) => x.id)).toEqual(["b", "a"]);
    expect(columnOf(tasks, "DONE")).toEqual([]);
  });

  it("pose la carte en bas de la colonne choisie", () => {
    expect(bottomPosition([])).toBe(0);
    expect(bottomPosition([0, 4, 2])).toBe(5);
    const moved = moveLocally(tasks, "b", "IN_PROGRESS");
    expect(moved.find((x) => x.id === "b")).toEqual({ id: "b", status: "IN_PROGRESS", position: 5 });
    expect(columnOf(moved, "IN_PROGRESS").map((x) => x.id)).toEqual(["c", "b"]);
    // « Annuler » remet la carte à sa place d'origine.
    expect(moveLocally(moved, "b", "TODO", 0).find((x) => x.id === "b")).toEqual({ id: "b", status: "TODO", position: 0 });
  });

  it("écrit les noms des colonnes et le message de déplacement", () => {
    expect(columnLabel("REVIEW", 1)).toBe("En revue, 1 tâche");
    expect(columnLabel("BACKLOG", 3)).toBe("Backlog, 3 tâches");
    expect(movedMessage("Maquette", "DONE")).toBe("« Maquette » déplacée dans « Terminée ».");
    expect(isTaskStatus("REVIEW")).toBe(true);
    expect(isTaskStatus("ARCHIVED")).toBe(false);
  });
});
