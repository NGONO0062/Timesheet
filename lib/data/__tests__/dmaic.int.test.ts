import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions, type Role } from "@/lib/permissions";
import type { ProjectInput } from "@/lib/projects/rules";
import { prisma, type DivisionScope } from "../db";
import { decideTollgate, DmaicRuleError, followUpExists, getFollowUp, requestTollgate, saveIndicator, setDeliverable } from "../dmaic";
import { changeProjectPhase, listProjects, ProjectRuleError, saveProject } from "../projects";

// Suivi DMAIC (PROMPT.md §9.4, lot 3) : sponsor, revues de passage, livrables, indicateur.
// Deux divisions d'intégration, vidées à chaque exécution (le journal d'audit, en ajout
// seul, les référence). SMTP_HOST est vidé : les e-mails ne partent pas, sans erreur.
process.env.SMTP_HOST = "";
const RUN = Date.now().toString(36);
const T = (day: string) => new Date(`2026-03-${day}T09:00:00Z`);
let division: string;
let other: string;
let manager: DivisionScope;
let sponsor: DivisionScope;
let outsider: DivisionScope;
let foreign: DivisionScope;
let staffId: string;

const input = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  name: "Réduction des réclamations",
  start: "02/03/2026",
  end: "",
  status: "IN_PROGRESS",
  kind: "DMAIC",
  budget: "",
  activities: ["Analyse"],
  memberIds: [staffId],
  ...over,
});

const scope = (u: { id: string; divisionId: string | null; role: string }): DivisionScope => ({
  divisionId: u.divisionId!,
  userId: u.id,
  role: u.role as Role,
  permissions: effectivePermissions(u.role as Role),
});

async function clean(id: string) {
  await prisma.project.deleteMany({ where: { divisionId: id } });
  await prisma.user.updateMany({ where: { divisionId: id }, data: { managerId: null } });
  await prisma.user.deleteMany({ where: { divisionId: id } });
}

async function divisionOf(slug: string, name: string) {
  const d = { name, slug, direction: "TEST", status: "ACTIVE" as const };
  const id = (await prisma.division.upsert({ where: { slug }, update: d, create: d })).id;
  await clean(id);
  return id;
}

const user = (divisionId: string, key: string, role: Role, managerId?: string) =>
  prisma.user.create({ data: { divisionId, email: `${key}-${RUN}@exemple.com`, firstName: key, lastName: "Test", role, managerId } });

beforeAll(async () => {
  division = await divisionOf("integration-dmaic", "Division d'intégration (DMAIC)");
  other = await divisionOf("integration-dmaic-b", "Division d'intégration (DMAIC, B)");
  const m = await user(division, "manager", "MANAGER");
  staffId = (await user(division, "staff", "STAFF", m.id)).id;
  manager = scope(m);
  // Un autre manager de la division, sans rattaché sur le projet : il ne le gère pas.
  sponsor = scope(await user(division, "sponsor", "MANAGER"));
  outsider = scope(await user(division, "outsider", "MANAGER"));
  foreign = scope(await user(other, "owner", "OWNER"));
});

afterAll(async () => {
  await clean(division);
  await clean(other);
  await prisma.$disconnect();
});

const create = async (over: Partial<ProjectInput> = {}) => (await saveProject(manager, null, input(over), T("02"), "manager Test")).id;
const code = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof DmaicRuleError || e instanceof ProjectRuleError ? e.code : String(e)));

describe("sponsor d'un projet DMAIC", () => {
  it("est choisi parmi les managers et owners actifs de la division", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    expect((await prisma.project.findUniqueOrThrow({ where: { id } })).sponsorId).toBe(sponsor.userId);
    expect(await code(saveProject(manager, id, input({ sponsorId: staffId }), T("03"), "manager Test"))).toBe("sponsor");
    expect(await code(saveProject(manager, id, input({ sponsorId: foreign.userId }), T("03"), "manager Test"))).toBe("sponsor");
    const { sponsors } = await listProjects(manager);
    expect(sponsors.map((s) => s.id).sort()).toEqual([manager.userId, sponsor.userId, outsider.userId].sort());
  });

  it("est retiré quand le projet redevient standard ; inchangé si le panneau ne l'envoie pas", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    await saveProject(manager, id, { ...input(), sponsorId: undefined }, T("03"), "manager Test");
    expect((await prisma.project.findUniqueOrThrow({ where: { id } })).sponsorId).toBe(sponsor.userId);
    await saveProject(manager, id, input({ kind: "STANDARD" }), T("03"), "manager Test");
    expect((await prisma.project.findUniqueOrThrow({ where: { id } })).sponsorId).toBeNull();
  });
});

describe("revue de passage", () => {
  it("sans sponsor, la phase se change directement et aucune revue ne se demande", async () => {
    const id = await create();
    expect(await code(requestTollgate(manager, id, "", T("05"), "manager Test"))).toBe("noSponsor");
    await changeProjectPhase(manager, id, "MEASURE", T("05"), "manager Test");
    expect((await prisma.project.findUniqueOrThrow({ where: { id } })).phase).toBe("MEASURE");
  });

  it("avec un sponsor : demande, compléments, nouvelle demande, passage accordé", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    // La phase suivante ne s'ouvre plus directement.
    expect(await code(changeProjectPhase(manager, id, "MEASURE", T("05"), "manager Test"))).toBe("tollgate");

    await requestTollgate(manager, id, "Charte signée", T("05"), "manager Test");
    expect(await code(requestTollgate(manager, id, "", T("05"), "manager Test"))).toBe("alreadyRequested");
    expect((await listProjects(manager)).projects.find((p) => p.id === id)?.tollgatePending).toBe(true);

    // Seul le sponsor décide ; un commentaire est exigé pour des compléments.
    expect(await code(decideTollgate(manager, id, "APPROVE", "", T("06"), "manager Test"))).toBe("notSponsor");
    expect(await code(decideTollgate(sponsor, id, "CHANGES", "  ", T("06"), "sponsor Test"))).toBe("commentMissing");
    await decideTollgate(sponsor, id, "CHANGES", "Ajoutez la voix du client", T("06"), "sponsor Test");
    expect(await code(decideTollgate(sponsor, id, "APPROVE", "", T("06"), "sponsor Test"))).toBe("notRequested");

    await requestTollgate(manager, id, "", T("09"), "manager Test");
    const r = await decideTollgate(sponsor, id, "APPROVE", "", T("10"), "sponsor Test");
    expect(r).toMatchObject({ approved: true, next: "MEASURE", requester: "manager Test" });

    const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { phaseChanges: { orderBy: { at: "asc" } }, tollgates: { orderBy: { requestedAt: "asc" } } } });
    expect(project.phase).toBe("MEASURE");
    expect(project.phaseChanges.map((c) => [c.phase, c.at.toISOString()])).toEqual([["DEFINE", T("02").toISOString()], ["MEASURE", T("10").toISOString()]]);
    expect(project.tollgates.map((g) => [g.phase, g.status, g.comment])).toEqual([
      ["DEFINE", "CHANGES_REQUESTED", "Ajoutez la voix du client"],
      ["DEFINE", "APPROVED", null],
    ]);
    const audit = await prisma.auditLog.findMany({ where: { divisionId: division, objectLabel: { endsWith: "Réduction des réclamations" }, action: { in: ["PROJECT_TOLLGATE_REQUESTED", "PROJECT_TOLLGATE_DECIDED"] } } });
    expect(audit.length).toBeGreaterThanOrEqual(4);

    // Revenir en arrière reste direct ; revenir ensuite à « Mesurer » aussi (passage accordé).
    await changeProjectPhase(manager, id, "DEFINE", T("11"), "manager Test");
    await changeProjectPhase(manager, id, "MEASURE", T("11"), "manager Test");
    expect(await code(changeProjectPhase(manager, id, "ANALYZE", T("11"), "manager Test"))).toBe("tollgate");
  });

  it("la revue de « Contrôler » clôt la démarche sans changer de phase ni de statut", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    await prisma.project.update({ where: { id }, data: { phase: "CONTROL" } });
    await requestTollgate(manager, id, "", T("12"), "manager Test");
    const r = await decideTollgate(sponsor, id, "APPROVE", "", T("13"), "sponsor Test");
    expect(r.next).toBeNull();
    const p = await prisma.project.findUniqueOrThrow({ where: { id } });
    expect([p.phase, p.status]).toEqual(["CONTROL", "IN_PROGRESS"]);
    expect(await code(requestTollgate(manager, id, "", T("13"), "manager Test"))).toBe("alreadyApproved");
  });
});

describe("portée du suivi", () => {
  it("le sponsor lit et décide sans gérer le projet ; il ne coche ni ne demande", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    expect(await followUpExists(sponsor, id)).toBe(true);
    const f = await getFollowUp(sponsor, id);
    expect(f).toMatchObject({ canManage: false, isSponsor: true });
    expect(await code(setDeliverable(sponsor, id, "DEFINE_CHARTER", true, T("05")))).toBe("notManaged");
    expect(await code(requestTollgate(sponsor, id, "", T("05"), "sponsor Test"))).toBe("notManaged");
  });

  it("un manager qui ne gère pas le projet et n'en est pas sponsor ne le voit pas", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    expect(await followUpExists(outsider, id)).toBe(false);
    expect(await getFollowUp(outsider, id)).toBeNull();
    expect(await code(decideTollgate(outsider, id, "APPROVE", "", T("05"), "outsider Test"))).toBe("notFound");
  });

  it("aucune donnée ne traverse d'une division à l'autre", async () => {
    const id = await create({ sponsorId: sponsor.userId });
    expect(await followUpExists(foreign, id)).toBe(false);
    expect(await getFollowUp(foreign, id)).toBeNull();
    expect(await code(setDeliverable(foreign, id, "DEFINE_CHARTER", true, T("05")))).toBe("notFound");
    expect(await code(saveIndicator(foreign, id, null, "owner Test"))).toBe("notFound");
    expect(await code(requestTollgate(foreign, id, "", T("05"), "owner Test"))).toBe("notFound");
  });
});

describe("livrables et indicateur", () => {
  it("coche et décoche un livrable, sans doublon", async () => {
    const id = await create();
    await setDeliverable(manager, id, "DEFINE_CHARTER", true, T("05"));
    await setDeliverable(manager, id, "DEFINE_CHARTER", true, T("05"));
    expect((await getFollowUp(manager, id))?.done).toEqual(["DEFINE_CHARTER"]);
    await setDeliverable(manager, id, "DEFINE_CHARTER", false, T("05"));
    expect((await getFollowUp(manager, id))?.done).toEqual([]);
  });

  it("enregistre puis retire l'indicateur", async () => {
    const id = await create();
    await saveIndicator(manager, id, { name: "Délai", unit: "jours", baseline: 12.5, target: 5, current: null }, "manager Test");
    expect((await getFollowUp(manager, id))?.indicator).toEqual({ name: "Délai", unit: "jours", baseline: 12.5, target: 5, current: null });
    await saveIndicator(manager, id, null, "manager Test");
    expect((await getFollowUp(manager, id))?.indicator).toBeNull();
  });

  it("refuse tout changement sur un projet standard ou archivé", async () => {
    const standard = await create({ kind: "STANDARD" });
    expect(await code(setDeliverable(manager, standard, "DEFINE_CHARTER", true, T("05")))).toBe("notDmaic");
    const archived = await create();
    await prisma.project.update({ where: { id: archived }, data: { archivedAt: T("05") } });
    expect(await code(saveIndicator(manager, archived, null, "manager Test"))).toBe("archived");
  });
});
