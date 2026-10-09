import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions } from "@/lib/permissions";
import { prisma, type DivisionScope } from "../db";
import {
  getEntrySettings, getWeekSheet, listEligibleLines, listMyProjects, listWeekSummaries, saveDraft, submitWeek, weekFrame,
  TimesheetRuleError,
} from "../timesheets";

// Fiches de temps sur la base du seed. Un compte temporaire de CX Expertise (rattaché
// à Samuel Etoga, membre de « Veille et formation ») est créé puis supprimé.
const RUN = Date.now().toString(36);
const NOW = new Date("2026-03-19T09:00:00Z"); // jeudi de la semaine 12
const W12 = { year: 2026, week: 12 };

let divisionA: string;
let divisionB: string;
let yannick: DivisionScope;
let outsider: DivisionScope;
let foreignProject: { id: string; activityId: string };

const staffScope = (divisionId: string, userId: string): DivisionScope => ({
  divisionId,
  userId,
  role: "STAFF",
  permissions: effectivePermissions("STAFF"),
});

beforeAll(async () => {
  divisionA = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
  const samuel = await prisma.user.findUniqueOrThrow({ where: { email: "samuel.etoga@exemple.com" } });
  const veille = await prisma.project.findUniqueOrThrow({ where: { divisionId_code: { divisionId: divisionA, code: "CX-2026-00" } } });
  const y = await prisma.user.create({
    data: {
      divisionId: divisionA,
      email: `integration-${RUN}@exemple.com`,
      firstName: "Test",
      lastName: "Intégration",
      role: "STAFF",
      managerId: samuel.id,
      memberships: { create: [{ projectId: veille.id }] },
    },
  });
  yannick = staffScope(divisionA, y.id);

  // Division B : un utilisateur, un projet en cours ouvert à tous ses membres.
  divisionB = (await prisma.division.create({ data: { name: `Division de test ${RUN}`, slug: `test-ts-${RUN}`, direction: "TEST", status: "ACTIVE" } })).id;
  const u = await prisma.user.create({ data: { divisionId: divisionB, email: `saisie-${RUN}@exemple.com`, firstName: "Test", lastName: "Saisie", role: "STAFF" } });
  outsider = staffScope(divisionB, u.id);
  const p = await prisma.project.create({
    include: { activities: true },
    data: {
      divisionId: divisionB,
      code: "TEST-01",
      name: "Projet d'une autre division",
      startDate: new Date("2026-01-01T00:00:00Z"),
      status: "IN_PROGRESS",
      activities: { create: [{ name: "Activité" }] },
      members: { create: [{ userId: u.id }] },
    },
  });
  foreignProject = { id: p.id, activityId: p.activities[0]!.id };
  await saveDraft(outsider, { week: W12, comment: "", lines: [{ projectId: p.id, activityId: foreignProject.activityId, hours: [8, 8, null, null, null] }] }, NOW);
});

afterAll(async () => {
  await prisma.timesheet.deleteMany({ where: { divisionId: divisionB } });
  await prisma.project.deleteMany({ where: { divisionId: divisionB } });
  await prisma.user.deleteMany({ where: { divisionId: divisionB } });
  await prisma.division.delete({ where: { id: divisionB } });
  await prisma.timesheet.deleteMany({ where: { userId: yannick.userId } });
  await prisma.projectMember.deleteMany({ where: { userId: yannick.userId } });
  await prisma.user.delete({ where: { id: yannick.userId } });
  await prisma.$disconnect();
});

describe("isolation entre divisions", () => {
  it("ne propose jamais le projet d'une autre division", async () => {
    const lines = await listEligibleLines(yannick, W12);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.projectId === foreignProject.id)).toBe(false);
    expect((await listMyProjects(yannick, W12)).some((p) => p.id === foreignProject.id)).toBe(false);
  });

  it("refuse d'enregistrer une ligne sur le projet d'une autre division", async () => {
    await expect(
      saveDraft(yannick, { week: W12, comment: "", lines: [{ projectId: foreignProject.id, activityId: foreignProject.activityId, hours: [1, null, null, null, null] }] }, NOW),
    ).rejects.toThrow(new TimesheetRuleError("lineNotAllowed"));
  });

  it("ne lit pas la fiche d'un utilisateur d'une autre division, même avec son identifiant", async () => {
    const frame = weekFrame(W12, await getEntrySettings(yannick));
    // Contexte forgé : identifiant de l'autre utilisateur, mais division A.
    const forged = { ...yannick, userId: outsider.userId };
    expect((await getWeekSheet(forged, W12, frame.days)).lines).toEqual([]);
    expect((await listWeekSummaries(forged, [W12]))[0]).toMatchObject({ stored: null, hours: 0 });
    // Le vrai contexte de B voit bien sa fiche.
    expect((await getWeekSheet(outsider, W12, frame.days)).lines).toHaveLength(1);
  });

  it("exige la permission de saisir", async () => {
    const owner: DivisionScope = { ...yannick, role: "OWNER", permissions: effectivePermissions("OWNER") };
    await expect(listEligibleLines(owner, W12)).rejects.toThrow(/ENTER_TIME/);
  });
});

describe("enregistrement et soumission", () => {
  it("refuse une semaine future quand la division l'interdit", async () => {
    await expect(saveDraft(yannick, { week: { year: 2026, week: 13 }, comment: "", lines: [] }, NOW)).rejects.toThrow(new TimesheetRuleError("futureWeek"));
  });

  it("enregistre le brouillon, refuse une soumission incomplète, puis soumet et journalise", async () => {
    const [veille] = (await listEligibleLines(yannick, W12)).filter((l) => l.code === "CX-2026-00");
    expect(veille).toBeDefined();
    const line = (hours: Array<number | null>) => ({ projectId: veille!.projectId, activityId: veille!.activityId, hours });

    await saveDraft(yannick, { week: W12, comment: "Semaine de formation", lines: [line([8, 8, 0, null, null])] }, NOW);
    const frame = weekFrame(W12, await getEntrySettings(yannick));
    const sheet = await getWeekSheet(yannick, W12, frame.days);
    expect(sheet).toMatchObject({ stored: "DRAFT", comment: "Semaine de formation" });
    expect(sheet.lines[0]!.hours).toEqual([8, 8, 0, null, null]);

    await expect(submitWeek(yannick, { week: W12, comment: "", lines: [line([8, 8, 0, null, null])] }, NOW, "Test Intégration")).rejects.toThrow(
      new TimesheetRuleError("incomplete"),
    );
    await expect(saveDraft(yannick, { week: W12, comment: "", lines: [line([8, 8, 8, 8, 8.3])] }, NOW)).rejects.toThrow(new TimesheetRuleError("invalidHours"));

    await submitWeek(yannick, { week: W12, comment: "", lines: [line([8, 8, 8, 8, 8])] }, NOW, "Test Intégration");
    const submitted = await prisma.timesheet.findFirstOrThrow({ where: { userId: yannick.userId, isoYear: 2026, isoWeek: 12 }, include: { events: true } });
    expect(submitted).toMatchObject({ status: "SUBMITTED", submissionCount: 1 });
    expect(submitted.events.map((e) => e.type).sort()).toEqual(["CREATED", "SUBMITTED"]);
    const audit = await prisma.auditLog.findFirst({ where: { action: "TIMESHEET_SUBMITTED", actorId: yannick.userId }, orderBy: { at: "desc" } });
    expect(audit).toMatchObject({ divisionId: divisionA, objectLabel: "Semaine 12", result: "SUCCESS" });

    // Soumise : plus modifiable.
    await expect(saveDraft(yannick, { week: W12, comment: "", lines: [line([8, 8, 8, 8, 8])] }, NOW)).rejects.toThrow(new TimesheetRuleError("notEditable"));
  });
});
