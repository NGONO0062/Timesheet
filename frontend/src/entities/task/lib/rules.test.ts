import { describe, expect, it } from "vitest";
import { bottomPosition, columnLabel, columnOf, movedMessage, moveLocally, titleError } from "./rules";

const tasks = [
  { id: "a", status: "BACKLOG" as const, position: 1 },
  { id: "b", status: "BACKLOG" as const, position: 0 },
  { id: "c", status: "IN_PROGRESS" as const, position: 0 },
];

describe("tableau Kanban : règles d'affichage", () => {
  it("range les cartes et pose une carte déplacée en bas de sa colonne", () => {
    expect(columnOf(tasks, "BACKLOG").map((x) => x.id)).toEqual(["b", "a"]);
    expect(bottomPosition([])).toBe(0);
    const moved = moveLocally(tasks, "a", "IN_PROGRESS");
    expect(columnOf(moved, "IN_PROGRESS").map((x) => x.id)).toEqual(["c", "a"]);
    expect(moveLocally(tasks, "c", "BACKLOG", 0).find((x) => x.id === "c")?.position).toBe(0);
  });

  it("nomme les colonnes et décrit les déplacements", () => {
    expect(columnLabel("IN_PROGRESS", 2)).toBe("En cours, 2 tâches");
    expect(columnLabel("BACKLOG", 0)).toBe("Backlog, 0 tâche");
    expect(movedMessage("Maquette", "REVIEW")).toBe("« Maquette » déplacée dans « En revue ».");
    expect(titleError("titleLong")).toBe("Le titre tient en 140 caractères au plus.");
  });
});
