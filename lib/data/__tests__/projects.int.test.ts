import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions, type Role } from "@/lib/permissions";
import type { ProjectInput } from "@/lib/projects/rules";
import { prisma, type DivisionScope } from "../db";
import { changeProjectPhase, listProjects, ProjectRuleError, saveProject } from "../projects";
import { createTask, getBoard, listBoardProjects, renameTask } from "../tasks";

// Projets DMAIC (PROMPT.md §9.4) : type, phase en cours, historique des phases. Les
// projets créés le sont dans une division fixe, réutilisée (le journal d'audit, en ajout
// seul, la référence) et vidée à chaque exécution. CX Expertise n'est que lue.
const RUN = Date.now().toString(36);
const NOW = new Date("2026-03-19T08:42:00Z");
const LATER = new Date("2026-03-20T10:00:00Z");
const UNDO = new Date("2026-03-20T10:00:05Z");
let division: string;
let manager: DivisionScope;
let staffId: string;

const input = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  name: "Réduction des délais de portabilité",
  start: "02/03/2026",
  end: "",
  status: "IN_PROGRESS",
  kind: "DMAIC",
  budget: "",
  activities: ["Analyse"],
  memberIds: [staffId],
  ...over,
});

async function scopeOf(email: string): Promise<DivisionScope> {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { divisionId: u.divisionId!, userId: u.id, role: u.role as Role, permissions: effectivePermissions(u.role as Role) };
}

async function clean() {
  await prisma.project.deleteMany({ where: { divisionId: division } });
  await prisma.user.updateMany({ where: { divisionId: division }, data: { managerId: null } });
  await prisma.user.deleteMany({ where: { divisionId: division } });
}

beforeAll(async () => {
  const d = { name: "Division d'intégration (projets)", slug: "integration-projets", direction: "TEST", status: "ACTIVE" as const };
  division = (await prisma.division.upsert({ where: { slug: d.slug }, update: d, create: d })).id;
  await clean();
  const m = await prisma.user.create({ data: { divisionId: division, email: `manager-${RUN}@exemple.com`, firstName: "Max", lastName: "Manager", role: "MANAGER" } });
  staffId = (await prisma.user.create({ data: { divisionId: division, email: `staff-${RUN}@exemple.com`, firstName: "Sam", lastName: "Staff", role: "STAFF", managerId: m.id } })).id;
  manager = { divisionId: division, userId: m.id, role: "MANAGER", permissions: effectivePermissions("MANAGER") };
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const history = (projectId: string) => prisma.projectPhaseChange.findMany({ where: { projectId }, orderBy: [{ at: "asc" }, { id: "asc" }], select: { phase: true, at: true } });

describe("projet DMAIC", () => {
  it("naît dans la phase « Définir », inscrite dans l'historique", async () => {
    const r = await saveProject(manager, null, input(), NOW, "Max Manager");
    const row = (await listProjects(manager)).projects.find((p) => p.id === r.id)!;
    expect([row.kind, row.phase]).toEqual(["DMAIC", "DEFINE"]);
    expect(await history(r.id)).toEqual([{ phase: "DEFINE", at: NOW }]);
  });

  it("change de phase tout de suite, puis revient en arrière (« Annuler »), chaque entrée datée", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet à faire avancer" }), NOW, "Max Manager");
    expect(await changeProjectPhase(manager, r.id, "MEASURE", LATER, "Max Manager")).toEqual({ name: "Projet à faire avancer", previous: "DEFINE" });
    expect((await prisma.project.findUniqueOrThrow({ where: { id: r.id } })).phase).toBe("MEASURE");
    await changeProjectPhase(manager, r.id, "DEFINE", UNDO, "Max Manager");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: r.id } })).phase).toBe("DEFINE");
    expect((await history(r.id)).map((h) => h.phase)).toEqual(["DEFINE", "MEASURE", "DEFINE"]);
    const audit = await prisma.auditLog.findFirst({ where: { divisionId: division, action: "PROJECT_PHASE_CHANGED", objectLabel: { endsWith: "Projet à faire avancer" } }, orderBy: { recordedAt: "asc" } });
    expect(audit?.metadata).toEqual({ from: "DEFINE", to: "MEASURE" });
  });

  it("n'écrit rien quand la phase ne change pas", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet immobile" }), NOW, "Max Manager");
    await changeProjectPhase(manager, r.id, "DEFINE", LATER, "Max Manager");
    expect(await history(r.id)).toHaveLength(1);
  });

  it("refuse une phase sur un projet standard", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet standard", kind: "STANDARD" }), NOW, "Max Manager");
    const row = await prisma.project.findUniqueOrThrow({ where: { id: r.id } });
    expect([row.kind, row.phase]).toEqual(["STANDARD", null]);
    await expect(changeProjectPhase(manager, r.id, "MEASURE", LATER, "Max Manager")).rejects.toEqual(new ProjectRuleError("notDmaic"));
    expect(await history(r.id)).toEqual([]);
  });

  it("passe de standard à DMAIC puis revient, en gardant l'historique", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet converti", kind: "STANDARD" }), NOW, "Max Manager");
    await saveProject(manager, r.id, input({ name: "Projet converti", kind: "DMAIC" }), LATER, "Max Manager");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: r.id } })).phase).toBe("DEFINE");
    await changeProjectPhase(manager, r.id, "MEASURE", LATER, "Max Manager");
    // Enregistrer le panneau sans changer de type garde la phase en cours.
    await saveProject(manager, r.id, input({ name: "Projet converti", kind: "DMAIC" }), LATER, "Max Manager");
    expect((await prisma.project.findUniqueOrThrow({ where: { id: r.id } })).phase).toBe("MEASURE");
    await saveProject(manager, r.id, input({ name: "Projet converti", kind: "STANDARD" }), LATER, "Max Manager");
    const row = await prisma.project.findUniqueOrThrow({ where: { id: r.id } });
    expect([row.kind, row.phase]).toEqual(["STANDARD", null]);
    expect((await history(r.id)).map((h) => h.phase)).toEqual(["DEFINE", "MEASURE"]);
  });

  it("ne laisse personne d'une autre division changer la phase", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet isolé" }), NOW, "Max Manager");
    for (const email of ["samuel.etoga@exemple.com", "brigitte.mbarga@exemple.com"]) {
      await expect(changeProjectPhase(await scopeOf(email), r.id, "MEASURE", LATER, "Intrus")).rejects.toEqual(new ProjectRuleError("notFound"));
    }
    expect((await prisma.project.findUniqueOrThrow({ where: { id: r.id } })).phase).toBe("DEFINE");
  });
});

describe("tâches d'un projet DMAIC", () => {
  it("prennent la phase en cours, ou celle choisie, et la gardent quand le projet avance", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet aux tâches" }), NOW, "Max Manager");
    await changeProjectPhase(manager, r.id, "MEASURE", LATER, "Max Manager");
    const board = (await listBoardProjects(manager)).find((p) => p.id === r.id);
    expect(board).toMatchObject({ kind: "DMAIC", phase: "MEASURE" });

    const current = await createTask(manager, r.id, "Plan de collecte", LATER);
    const chosen = await createTask(manager, r.id, "Pareto des causes", LATER, "ANALYZE");
    await changeProjectPhase(manager, r.id, "ANALYZE", LATER, "Max Manager");
    const phases = new Map((await getBoard(manager, r.id)).map((x) => [x.id, x.phase]));
    expect([phases.get(current.id), phases.get(chosen.id)]).toEqual(["MEASURE", "ANALYZE"]);

    // Modification : le titre seul garde la phase ; une phase choisie la remplace.
    expect(await renameTask(manager, current.id, "Plan de collecte des données")).toMatchObject({ phase: "MEASURE" });
    expect(await renameTask(manager, current.id, "Plan de collecte des données", "DEFINE")).toMatchObject({ phase: "DEFINE" });
  });

  it("n'ont pas de phase sur un projet standard, même si une phase est envoyée", async () => {
    const r = await saveProject(manager, null, input({ name: "Projet standard aux tâches", kind: "STANDARD" }), NOW, "Max Manager");
    const task = await createTask(manager, r.id, "Tâche ordinaire", LATER, "CONTROL");
    expect((await getBoard(manager, r.id)).find((x) => x.id === task.id)?.phase).toBeNull();
    expect(await renameTask(manager, task.id, "Tâche ordinaire", "CONTROL")).toMatchObject({ phase: null });
  });
});

describe("projet DMAIC du seed", () => {
  it("« Cartographie des irritants » est en phase « Analyser » depuis le lundi de la semaine 12", async () => {
    const cx = await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } });
    const p = await prisma.project.findUniqueOrThrow({ where: { divisionId_code: { divisionId: cx.id, code: "CX-2026-03" } } });
    expect([p.kind, p.phase]).toEqual(["DMAIC", "ANALYZE"]);
    expect((await history(p.id)).map((h) => [h.phase, h.at.toISOString().slice(0, 10)])).toEqual([
      ["DEFINE", "2026-02-02"],
      ["MEASURE", "2026-02-23"],
      ["ANALYZE", "2026-03-16"],
    ]);
  });
});
