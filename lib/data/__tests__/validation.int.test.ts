import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePermissions, type Role } from "@/lib/permissions";
import { prisma, type DivisionScope } from "../db";
import { decide, getReview, listQueue, listReviewablePeople, sendDueReminders, ValidationRuleError } from "../validation";

// Validation sur la base du seed. Une division étrangère et un compte temporaire
// de CX Expertise (rattaché à Samuel Etoga) sont créés puis supprimés.
const RUN = Date.now().toString(36);
const NOW = new Date("2026-03-19T09:00:00Z");
const ALL = { personId: null, weeks: null };

let divisionA: string;
let divisionB: string;
let samuel: DivisionScope;
let helene: DivisionScope;
let brigitte: DivisionScope;
let tempUser: string;
let foreignSheet: string;

const scopeOf = (divisionId: string, userId: string, role: Role): DivisionScope => ({ divisionId, userId, role, permissions: effectivePermissions(role) });
const userId = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

async function submittedSheet(user: string, divisionId: string, week: number, submittedAt: string) {
  const project = await prisma.project.findFirstOrThrow({ where: { divisionId }, include: { activities: true } });
  return prisma.timesheet.create({
    data: {
      divisionId,
      userId: user,
      isoYear: 2026,
      isoWeek: week,
      status: "SUBMITTED",
      submittedAt: new Date(submittedAt),
      submissionCount: 1,
      lines: {
        create: [{
          projectId: project.id,
          activityId: project.activities[0]!.id,
          position: 0,
          entries: { create: [0, 1, 2, 3, 4].map((d) => ({ date: new Date(Date.UTC(2026, 0, 5 + (week - 2) * 7 + d)), hours: 8 })) },
        }],
      },
      events: { create: [{ type: "SUBMITTED", actorId: user, at: new Date(submittedAt) }] },
    },
  });
}

beforeAll(async () => {
  divisionA = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
  samuel = scopeOf(divisionA, await userId("samuel.etoga@exemple.com"), "MANAGER");
  helene = scopeOf(divisionA, await userId("helene.nkoa@exemple.com"), "MANAGER");
  brigitte = scopeOf(divisionA, await userId("brigitte.mbarga@exemple.com"), "OWNER");

  tempUser = (
    await prisma.user.create({
      data: { divisionId: divisionA, email: `validation-${RUN}@exemple.com`, firstName: "Test", lastName: "Validation", role: "STAFF", managerId: samuel.userId },
    })
  ).id;

  // Division B : un manager « Samuel » ailleurs ne doit rien changer.
  divisionB = (await prisma.division.create({ data: { name: `Division de test ${RUN}`, slug: `test-val-${RUN}`, direction: "TEST", status: "ACTIVE" } })).id;
  const outsider = await prisma.user.create({ data: { divisionId: divisionB, email: `val-b-${RUN}@exemple.com`, firstName: "Test", lastName: "Ailleurs", role: "STAFF", managerId: samuel.userId } });
  await prisma.project.create({ data: { divisionId: divisionB, code: "B-01", name: "Projet B", startDate: new Date("2026-01-01T00:00:00Z"), status: "IN_PROGRESS", activities: { create: [{ name: "Activité" }] } } });
  foreignSheet = (await submittedSheet(outsider.id, divisionB, 12, "2026-03-18T15:00:00Z")).id;
});

afterAll(async () => {
  await prisma.timesheet.deleteMany({ where: { OR: [{ userId: tempUser }, { divisionId: divisionB }] } });
  await prisma.user.delete({ where: { id: tempUser } });
  await prisma.project.deleteMany({ where: { divisionId: divisionB } });
  await prisma.user.deleteMany({ where: { divisionId: divisionB } });
  await prisma.division.delete({ where: { id: divisionB } });
  await prisma.$disconnect();
});

describe("portée du validateur", () => {
  it("un manager voit les fiches de ses rattachés directs, file de la maquette 07", async () => {
    const { rows, counts } = await listQueue(samuel, ALL, "SUBMITTED");
    const names = rows.map((r) => `${r.name} S${r.week.week}`);
    expect(names).toEqual(expect.arrayContaining(["Laure Bikoï S12", "Sandrine Mvondo S12", "Yannick Essomba S12", "Ibrahim Njoya S11"]));
    expect(rows.find((r) => r.name === "Ibrahim Njoya")).toMatchObject({ submissionCount: 2, projects: 2, hours: 40, expected: 40 });
    expect(counts.REJECTED).toBeGreaterThanOrEqual(1); // Kevin Fotso, semaine 12
    // Ni les brouillons, ni une autre équipe, ni une autre division.
    expect(names.some((n) => n.startsWith("Aïcha Ndongo S12"))).toBe(false);
    expect(rows.some((r) => r.id === foreignSheet)).toBe(false);
    const people = (await listReviewablePeople(samuel)).map((p) => p.name);
    expect(people).toContain("Kevin Fotso");
    expect(people).not.toContain("Christelle Nana");
  });

  it("un autre manager ne voit pas l'équipe de Samuel Etoga ; l'owner voit toute sa division", async () => {
    const heleneRows = (await listQueue(helene, ALL, "ALL")).rows.map((r) => r.name);
    expect(heleneRows).not.toContain("Laure Bikoï");
    const brigitteRows = (await listQueue(brigitte, ALL, "SUBMITTED")).rows;
    expect(brigitteRows.map((r) => r.name)).toContain("Laure Bikoï");
    expect(brigitteRows.some((r) => r.id === foreignSheet)).toBe(false);
  });

  it("refuse le détail et la décision hors de portée", async () => {
    expect(await getReview(samuel, foreignSheet)).toBeNull();
    expect(await getReview(brigitte, foreignSheet)).toBeNull();
    const laure = (await listQueue(samuel, ALL, "SUBMITTED")).rows.find((r) => r.name === "Laure Bikoï")!;
    expect(await getReview(helene, laure.id)).toBeNull();
    expect(await decide(samuel, [foreignSheet], { kind: "VALIDATE" }, NOW, "Samuel Etoga")).toMatchObject({ done: 0, skipped: 1 });
    expect(await decide(helene, [laure.id], { kind: "VALIDATE" }, NOW, "Hélène Nkoa")).toMatchObject({ done: 0, skipped: 1 });
    expect((await prisma.timesheet.findUniqueOrThrow({ where: { id: foreignSheet } })).status).toBe("SUBMITTED");
  });

  it("exige la permission de valider", async () => {
    const staff = scopeOf(divisionA, tempUser, "STAFF");
    await expect(listQueue(staff, ALL, "SUBMITTED")).rejects.toThrow(/VALIDATE_TEAM/);
  });
});

describe("décisions", () => {
  it("rejette avec un motif obligatoire, signale une cellule, journalise", async () => {
    const sheet = await submittedSheet(tempUser, divisionA, 10, "2026-03-06T15:00:00Z");
    await expect(decide(samuel, [sheet.id], { kind: "REJECT", reason: "  " }, NOW, "Samuel Etoga")).rejects.toThrow(new ValidationRuleError("reasonMissing"));
    const line = await prisma.timesheetLine.findFirstOrThrow({ where: { timesheetId: sheet.id } });
    const r = await decide(samuel, [sheet.id], { kind: "REJECT", reason: "Jeudi à revoir.", flags: [{ lineId: line.id, day: 3 }] }, NOW, "Samuel Etoga");
    expect(r).toMatchObject({ done: 1, skipped: 0 });
    const after = await prisma.timesheet.findUniqueOrThrow({ where: { id: sheet.id }, include: { events: true, lines: { include: { entries: true } } } });
    expect(after).toMatchObject({ status: "REJECTED", rejectionReason: "Jeudi à revoir.", decidedById: samuel.userId });
    expect(after.lines[0]!.entries.filter((e) => e.flagged).map((e) => e.date.toISOString().slice(0, 10))).toEqual(["2026-03-05"]);
    expect(after.events.map((e) => e.type).sort()).toEqual(["REJECTED", "SUBMITTED"]);
    expect(await prisma.auditLog.findFirst({ where: { action: "TIMESHEET_REJECTED", objectLabel: "Semaine 10 · Test Validation" } })).not.toBeNull();
    // Déjà traitée : une seconde décision ne change rien.
    expect(await decide(samuel, [sheet.id], { kind: "VALIDATE" }, NOW, "Samuel Etoga")).toMatchObject({ done: 0, skipped: 1 });
  });

  it("valide en groupe et verrouille", async () => {
    const a = await submittedSheet(tempUser, divisionA, 8, "2026-02-20T15:00:00Z");
    const b = await submittedSheet(tempUser, divisionA, 9, "2026-02-27T15:00:00Z");
    expect(await decide(samuel, [a.id, b.id], { kind: "VALIDATE" }, NOW, "Samuel Etoga")).toMatchObject({ done: 2, skipped: 0 });
    const statuses = await prisma.timesheet.findMany({ where: { id: { in: [a.id, b.id] } }, select: { status: true } });
    expect(statuses.map((s) => s.status)).toEqual(["VALIDATED", "VALIDATED"]);
  });
});

describe("relance du validateur", () => {
  it("relance après 3 jours ouvrés sans décision, une seule fois par soumission", async () => {
    const sheet = await submittedSheet(tempUser, divisionA, 11, "2026-03-13T15:00:00Z"); // vendredi 13 mars
    await sendDueReminders(new Date("2026-03-18T09:00:00Z")); // mercredi 18 : pas encore
    expect(await prisma.timesheetEvent.count({ where: { timesheetId: sheet.id, type: "REMINDER_SENT" } })).toBe(0);
    await sendDueReminders(NOW); // jeudi 19 : 3 jours ouvrés révolus
    const reminders = await prisma.timesheetEvent.findMany({ where: { timesheetId: sheet.id, type: "REMINDER_SENT" } });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.actorId).toBe(samuel.userId);
    await sendDueReminders(new Date("2026-03-20T09:00:00Z"));
    expect(await prisma.timesheetEvent.count({ where: { timesheetId: sheet.id, type: "REMINDER_SENT" } })).toBe(1);
  });
});
