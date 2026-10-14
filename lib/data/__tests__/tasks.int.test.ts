import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions, type Role } from "@/lib/permissions";
import { AccessDenied, prisma, type DivisionScope } from "../db";
import { createTask, getBoard, listBoardProjects, moveTask, renameTask, setTaskDeleted, TaskRuleError } from "../tasks";

// Tableau Kanban (PROMPT.md §9.12), sur la base du seed. Les tâches créées ici sont
// effacées à la fin ; celles du seed ne sont pas modifiées.
const NOW = new Date("2026-03-19T08:42:00Z");
const created: string[] = [];
let divisionA: string;
let refonte: string; // CX-2026-01 : Aïcha et Kevin membres, Samuel responsable
let usage: string; // CX-2026-04 : terminé
let studies: string; // CX-2026-07 : équipe d'Hélène Nkoa

async function scopeOf(email: string): Promise<DivisionScope> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { divisionId: u.divisionId!, userId: u.id, role: u.role as Role, permissions: effectivePermissions(u.role as Role) };
}

beforeAll(async () => {
  divisionA = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
  const code = async (c: string) => (await prisma.project.findUniqueOrThrow({ where: { divisionId_code: { divisionId: divisionA, code: c } } })).id;
  [refonte, usage, studies] = await Promise.all([code("CX-2026-01"), code("CX-2026-04"), code("CX-2026-07")]);
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("tableau Kanban d'un projet", () => {
  it("ouvre aux membres les projets dont ils font partie, et seulement ceux-là", async () => {
    const aicha = await scopeOf("aicha.ndongo@exemple.com");
    const ids = (await listBoardProjects(aicha)).map((p) => p.id);
    expect(ids).toContain(refonte);
    expect(ids).not.toContain(studies);
    await expect(getBoard(aicha, studies)).rejects.toEqual(new TaskRuleError("notFound"));
  });

  it("crée en bas du Backlog ; manager responsable et owner voient la tâche, pas un autre manager", async () => {
    const aicha = await scopeOf("aicha.ndongo@exemple.com");
    const r = await createTask(aicha, refonte, "  Relire   le questionnaire ", NOW);
    created.push(r.id);
    expect(r.title).toBe("Relire le questionnaire");

    const board = await getBoard(await scopeOf("samuel.etoga@exemple.com"), refonte);
    const task = board.find((x) => x.id === r.id)!;
    expect(task).toMatchObject({ status: "BACKLOG", createdBy: "Aïcha Ndongo" });
    expect(Math.max(...board.filter((x) => x.status === "BACKLOG").map((x) => x.position))).toBe(task.position);
    expect((await getBoard(await scopeOf("brigitte.mbarga@exemple.com"), refonte)).some((x) => x.id === r.id)).toBe(true);
    await expect(getBoard(await scopeOf("helene.nkoa@exemple.com"), refonte)).rejects.toEqual(new TaskRuleError("notFound"));
    await expect(getBoard(await scopeOf("christelle.nana@exemple.com"), refonte)).rejects.toEqual(new TaskRuleError("notFound"));
  });

  it("déplace en bas de la colonne, puis revient à sa place (« Annuler »)", async () => {
    const kevin = await scopeOf("kevin.fotso@exemple.com");
    const r = await createTask(kevin, refonte, "Tâche à déplacer", NOW);
    created.push(r.id);
    const moved = await moveTask(kevin, r.id, "IN_PROGRESS");
    const board = await getBoard(kevin, refonte);
    const inProgress = board.filter((x) => x.status === "IN_PROGRESS");
    expect(inProgress.at(-1)!.id).toBe(r.id);
    await moveTask(kevin, r.id, moved.previous.status, moved.previous.position);
    expect((await getBoard(kevin, refonte)).find((x) => x.id === r.id)).toMatchObject({ status: "BACKLOG", position: moved.previous.position });
  });

  it("renomme, supprime puis rétablit une tâche", async () => {
    const aicha = await scopeOf("aicha.ndongo@exemple.com");
    const r = await createTask(aicha, refonte, "Brouillon", NOW);
    created.push(r.id);
    await expect(renameTask(aicha, r.id, "   ")).rejects.toEqual(new TaskRuleError("invalid", "Saisissez le titre de la tâche."));
    expect(await renameTask(aicha, r.id, "Titre final")).toEqual({ title: "Titre final", previous: "Brouillon" });
    await setTaskDeleted(aicha, r.id, true, NOW);
    expect((await getBoard(aicha, refonte)).some((x) => x.id === r.id)).toBe(false);
    await expect(moveTask(aicha, r.id, "DONE")).rejects.toEqual(new TaskRuleError("notFound"));
    await setTaskDeleted(aicha, r.id, false, NOW);
    expect((await getBoard(aicha, refonte)).find((x) => x.id === r.id)?.title).toBe("Titre final");
  });

  it("garde en lecture seule le tableau d'un projet terminé", async () => {
    const kevin = await scopeOf("kevin.fotso@exemple.com");
    expect(await getBoard(kevin, usage)).toEqual([]);
    await expect(createTask(kevin, usage, "Interdit", NOW)).rejects.toEqual(new TaskRuleError("readOnly"));
  });

  it("n'ouvre rien d'une autre division, ni sans permission", async () => {
    const aicha = await scopeOf("aicha.ndongo@exemple.com");
    const other = await prisma.division.findFirstOrThrow({ where: { id: { not: divisionA } } });
    await expect(getBoard({ ...aicha, divisionId: other.id }, refonte)).rejects.toEqual(new TaskRuleError("notFound"));
    await expect(listBoardProjects({ ...aicha, permissions: new Set() })).rejects.toBeInstanceOf(AccessDenied);
  });
});
