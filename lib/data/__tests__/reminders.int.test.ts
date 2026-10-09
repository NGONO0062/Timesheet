import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { needsFillReminder, sendFillReminders } from "../reminders";

// Rappel de saisie du vendredi (jalon 8), dans une division fixe et dédiée : la tâche ne
// touche ni CX Expertise ni son journal. Jeudi 19 mars 2026, semaine 12, avant l'échéance.
const SLUG = "integration-rappels";
const THURSDAY = new Date("2026-03-19T10:00:00Z");
let divisionId: string;
const ids: Record<"partial" | "complete" | "optOut" | "submitted", string> = { partial: "", complete: "", optOut: "", submitted: "" };

beforeAll(async () => {
  const data = { name: "Division d'intégration (rappels)", slug: SLUG, direction: "TEST", status: "ACTIVE" as const };
  divisionId = (await prisma.division.upsert({ where: { slug: SLUG }, update: data, create: data })).id;
  await prisma.timesheet.deleteMany({ where: { divisionId } });
  await prisma.project.deleteMany({ where: { divisionId } });
  await prisma.user.deleteMany({ where: { divisionId } });
  await prisma.divisionSettings.deleteMany({ where: { divisionId } });
  await prisma.divisionSettings.create({ data: { divisionId } });
  const run = Date.now().toString(36);
  const project = await prisma.project.create({
    data: { divisionId, code: "RAP-1", name: "Projet rappels", status: "IN_PROGRESS", startDate: new Date("2026-01-01T00:00:00Z"), activities: { create: [{ name: "Analyse" }] } },
    include: { activities: true },
  });
  for (const k of Object.keys(ids) as Array<keyof typeof ids>) {
    const u = await prisma.user.create({
      data: { divisionId, email: `rappel-${k}-${run}@exemple.com`, firstName: "Rappel", lastName: k, role: "STAFF", passwordHash: "x", notificationPrefs: k === "optOut" ? { fillReminder: false } : {} },
    });
    ids[k] = u.id;
    const hours = k === "complete" || k === "submitted" ? 8 : 4;
    await prisma.timesheet.create({
      data: {
        divisionId,
        userId: u.id,
        isoYear: 2026,
        isoWeek: 12,
        status: k === "submitted" ? "SUBMITTED" : "DRAFT",
        lines: {
          create: [{ projectId: project.id, activityId: project.activities[0]!.id, position: 0, entries: { create: [0, 1, 2, 3, 4].map((i) => ({ date: new Date(Date.UTC(2026, 2, 16 + i)), hours })) } }],
        },
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("rappel de saisie du vendredi", () => {
  it("vise les semaines incomplètes, non soumises", () => {
    expect(needsFillReminder(null, 0, 40)).toBe(true);
    expect(needsFillReminder("DRAFT", 39.5, 40)).toBe(true);
    expect(needsFillReminder("REJECTED", 10, 40)).toBe(true);
    expect(needsFillReminder("DRAFT", 40, 40)).toBe(false);
    expect(needsFillReminder("SUBMITTED", 0, 40)).toBe(false);
    expect(needsFillReminder(null, 0, 0)).toBe(false);
  });

  it("écrit une fois à chaque personne concernée, selon sa préférence", async () => {
    expect(await sendFillReminders(THURSDAY, [divisionId])).toBe(1);
    const rows = await prisma.auditLog.findMany({ where: { divisionId, action: "FILL_REMINDER_SENT", metadata: { path: ["week"], equals: "2026-S12" } } });
    const users = rows.map((r) => (r.metadata as { userId: string }).userId);
    expect(users).toContain(ids.partial);
    expect(users).not.toContain(ids.optOut);
    expect(users).not.toContain(ids.complete);
    // Deuxième appel la même semaine : rien de plus.
    expect(await sendFillReminders(THURSDAY, [divisionId])).toBe(0);
  });

  it("ne rappelle plus rien une fois l'échéance passée", async () => {
    expect(await sendFillReminders(new Date("2026-03-20T18:30:00Z"), [divisionId])).toBe(0);
  });
});
