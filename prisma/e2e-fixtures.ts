// Données des tests de bout en bout qui modifient la base (saisie, soumission).
// Elles visent trois comptes du seed qui n'apparaissent dans aucune maquette :
// les comptes de référence (Aïcha Ndongo, Kevin Fotso…) restent intacts.
import prismaClient from "@prisma/client";

export const E2E_USERS = {
  /** Semaine 12 vide : ajout de lignes, sauvegarde, soumission (desktop). */
  empty: "laure.bikoi@exemple.com",
  /** Semaine 12 rejetée, une cellule signalée : correction et nouvelle soumission. */
  rejected: "ibrahim.njoya@exemple.com",
  /** Semaine 12 en brouillon avec une ligne verrouillée : saisie mobile. */
  mobile: "sandrine.mvondo@exemple.com",
} as const;

const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const MONDAY_W12 = new Date("2026-03-16T00:00:00Z");

export async function resetE2eFixtures(): Promise<void> {
  const prisma = new prismaClient.PrismaClient();
  try {
    const users = await prisma.user.findMany({ where: { email: { in: Object.values(E2E_USERS) } } });
    const byEmail = (email: string) => {
      const u = users.find((x) => x.email === email);
      if (!u?.divisionId) throw new Error(`Compte de test absent du seed : ${email}`);
      return { id: u.id, divisionId: u.divisionId, managerId: u.managerId };
    };
    // Les lignes, entrées et événements suivent (suppression en cascade).
    await prisma.timesheet.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });

    const activity = async (divisionId: string, code: string, name: string) => {
      const a = await prisma.activity.findFirst({ where: { name, project: { divisionId, code } } });
      if (!a) throw new Error(`Activité absente du seed : ${code} / ${name}`);
      return a;
    };
    const entries = (hours: Array<number | null>, flaggedDay?: number) =>
      hours.flatMap((h, i) => (h === null ? [] : [{ date: plusDays(MONDAY_W12, i), hours: h, flagged: i === flaggedDay }]));

    // Ibrahim Njoya : semaine 12 soumise mercredi, rejetée jeudi matin, jeudi signalé
    // (avant l'horloge de démonstration, pour que la nouvelle soumission vienne après).
    const ibrahim = byEmail(E2E_USERS.rejected);
    const refonte = await activity(ibrahim.divisionId, "CX-2026-01", "Tests utilisateurs");
    const veille = await activity(ibrahim.divisionId, "CX-2026-00", "Formation");
    const rejected = await prisma.timesheet.create({
      data: {
        divisionId: ibrahim.divisionId,
        userId: ibrahim.id,
        isoYear: 2026,
        isoWeek: 12,
        status: "REJECTED",
        submittedAt: new Date("2026-03-18T15:00:00Z"),
        submissionCount: 1,
        decidedById: ibrahim.managerId,
        decidedAt: new Date("2026-03-19T07:00:00Z"),
        rejectionReason: "Jeudi 19 mars : 7 h sur Refonte parcours souscription, à vérifier.",
        lines: {
          create: [
            { projectId: refonte.projectId, activityId: refonte.id, position: 0, entries: { create: entries([6, 6, 6, 7, 6], 3) } },
            { projectId: veille.projectId, activityId: veille.id, position: 1, entries: { create: entries([2, 2, 2, 1, 2]) } },
          ],
        },
      },
    });
    await prisma.timesheetEvent.createMany({
      data: [
        { timesheetId: rejected.id, type: "SUBMITTED", actorId: ibrahim.id, at: new Date("2026-03-18T15:00:00Z") },
        { timesheetId: rejected.id, type: "REJECTED", actorId: ibrahim.managerId!, at: new Date("2026-03-19T07:00:00Z") },
      ],
    });

    // Sandrine Mvondo : brouillon avec une ligne d'un projet terminé (lecture seule).
    const sandrine = byEmail(E2E_USERS.mobile);
    const usage = await activity(sandrine.divisionId, "CX-2026-04", "Tests utilisateurs");
    const formation = await activity(sandrine.divisionId, "CX-2026-00", "Formation");
    await prisma.timesheet.create({
      data: {
        divisionId: sandrine.divisionId,
        userId: sandrine.id,
        isoYear: 2026,
        isoWeek: 12,
        lines: {
          create: [
            { projectId: usage.projectId, activityId: usage.id, position: 0, entries: { create: entries([2, null, null, null, null]) } },
            { projectId: formation.projectId, activityId: formation.id, position: 1, entries: { create: entries([6, 8, 8, null, null]) } },
          ],
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
