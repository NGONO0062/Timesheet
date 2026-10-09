// Données des tests de bout en bout qui modifient la base (saisie, soumission,
// validation). Elles vivent dans une division de test à part : les données de
// démonstration de CX Expertise, qui reproduisent les maquettes, ne sont jamais
// modifiées. Comptes fictifs, mot de passe SEED_PASSWORD.
import prismaClient from "@prisma/client";
import { argon2id } from "hash-wasm";

export const E2E_DIVISION = "e2e-tests";

export const E2E = {
  manager: { email: "manager.e2e@exemple.com", firstName: "Martin", lastName: "Valideur" },
  /** Semaine 12 vide : ajout de lignes, sauvegarde, soumission (desktop). */
  empty: { email: "saisie.e2e@exemple.com", firstName: "Léa", lastName: "Saisie" },
  /** Semaine 12 rejetée, une cellule signalée : correction et nouvelle soumission. */
  rejected: { email: "rejet.e2e@exemple.com", firstName: "Rémi", lastName: "Rejet" },
  /** Semaine 12 en brouillon avec une ligne verrouillée : saisie mobile. */
  mobile: { email: "mobile.e2e@exemple.com", firstName: "Nina", lastName: "Mobile" },
  /** Semaine 12 soumise : validation groupée. */
  alice: { email: "alice.e2e@exemple.com", firstName: "Alice", lastName: "Essai" },
  /** Semaine 12 soumise : rejet groupé. */
  bruno: { email: "bruno.e2e@exemple.com", firstName: "Bruno", lastName: "Essai" },
  /** Semaine 12 soumise : rejet depuis le détail, avec une cellule signalée. */
  chloe: { email: "chloe.e2e@exemple.com", firstName: "Chloé", lastName: "Essai" },
  /** Semaine 11 soumise : validation depuis le détail. */
  david: { email: "david.e2e@exemple.com", firstName: "David", lastName: "Essai" },
  /** Stagiaire : février 2026 validé, fiche de présence à signer (circuit complet). */
  intern: { email: "stagiaire.e2e@exemple.com", firstName: "Inès", lastName: "Stage" },
} as const;

/** Adresse RH de la division de test : l'e-mail de la fiche de présence arrive dans Mailpit. */
export const E2E_HR_EMAIL = "rh.e2e@exemple.com";

const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const MONDAY = { 11: new Date("2026-03-09T00:00:00Z"), 12: new Date("2026-03-16T00:00:00Z") } as const;

async function hash(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({ password, salt, parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32, outputType: "encoded" });
}

export async function resetE2eFixtures(): Promise<void> {
  const prisma = new prismaClient.PrismaClient();
  try {
    // Division, comptes et projets : créés une fois.
    const division =
      (await prisma.division.findUnique({ where: { slug: E2E_DIVISION } })) ??
      (await prisma.division.create({
        data: { name: "Division de test", slug: E2E_DIVISION, direction: "TEST", status: "ACTIVE", onboardingStep: 5, settings: { create: {} } },
      }));
    const passwordHash = await hash(process.env.SEED_PASSWORD ?? "Demo-TimeSheet-2026");
    const upsert = async (p: { email: string; firstName: string; lastName: string }, role: "MANAGER" | "STAFF", managerId: string | null) =>
      prisma.user.upsert({
        where: { email: p.email },
        update: { passwordHash, active: true, managerId, notificationPrefs: {} },
        create: { divisionId: division.id, email: p.email, firstName: p.firstName, lastName: p.lastName, role, managerId, passwordHash },
      });
    const manager = await upsert(E2E.manager, "MANAGER", null);
    const keys = ["empty", "rejected", "mobile", "alice", "bruno", "chloe", "david", "intern"] as const;
    const staff = {} as Record<(typeof keys)[number], { id: string }>;
    for (const k of keys) staff[k] = await upsert(E2E[k], "STAFF", manager.id);

    const project = async (code: string, name: string, status: "IN_PROGRESS" | "DONE", end: string) => {
      const existing = await prisma.project.findUnique({ where: { divisionId_code: { divisionId: division.id, code } }, include: { activities: true } });
      // Nom, statut et archivage modifiés par les tests de l'écran Projets : remis à l'état de départ.
      if (existing) {
        return prisma.project.update({
          where: { id: existing.id },
          include: { activities: true },
          data: { name, status, archivedAt: null },
        });
      }
      return prisma.project.create({
        include: { activities: true },
        data: {
          divisionId: division.id,
          code,
          name,
          status,
          startDate: new Date("2026-01-01T00:00:00Z"),
          endDate: new Date(`${end}T00:00:00Z`),
          activities: { create: [{ name: code === "CX-2026-00" ? "Formation" : "Tests utilisateurs" }] },
          members: { create: Object.values(staff).map((u) => ({ userId: u.id })) },
        },
      });
    };
    const veille = await project("CX-2026-00", "Veille et formation", "IN_PROGRESS", "2026-12-31");
    const refonte = await project("CX-2026-01", "Refonte parcours souscription", "IN_PROGRESS", "2026-06-26");
    const usage = await project("CX-2026-04", "Tests d'usage appli mobile", "DONE", "2026-02-27");
    const line = (p: typeof veille) => ({ projectId: p.id, activityId: p.activities[0]!.id });

    // Fiches : remises à leur état de départ à chaque exécution (lignes, entrées et événements suivent).
    await prisma.timesheet.deleteMany({ where: { divisionId: division.id } });
    // Projets créés par les tests de l'écran Projets (activités et membres suivent).
    await prisma.project.deleteMany({ where: { divisionId: division.id, code: { notIn: ["CX-2026-00", "CX-2026-01", "CX-2026-04"] } } });

    const entries = (week: 11 | 12, hours: Array<number | null>, flaggedDay?: number) =>
      hours.flatMap((h, i) => (h === null ? [] : [{ date: plusDays(MONDAY[week], i), hours: h, flagged: i === flaggedDay }]));
    const sheet = async (
      userId: string,
      week: 11 | 12,
      status: "DRAFT" | "SUBMITTED" | "REJECTED",
      lines: Array<{ projectId: string; activityId: string; hours: Array<number | null>; flaggedDay?: number }>,
      events: Array<{ type: string; actorId: string; at: string; note?: string }> = [],
      extra: { submittedAt?: string; decidedAt?: string; reason?: string } = {},
    ) => {
      const ts = await prisma.timesheet.create({
        data: {
          divisionId: division.id,
          userId,
          isoYear: 2026,
          isoWeek: week,
          status,
          submittedAt: extra.submittedAt ? new Date(extra.submittedAt) : null,
          submissionCount: extra.submittedAt ? 1 : 0,
          decidedById: extra.decidedAt ? manager.id : null,
          decidedAt: extra.decidedAt ? new Date(extra.decidedAt) : null,
          rejectionReason: extra.reason ?? null,
          lines: {
            create: lines.map((l, position) => ({
              projectId: l.projectId,
              activityId: l.activityId,
              position,
              entries: { create: entries(week, l.hours, l.flaggedDay) },
            })),
          },
        },
      });
      if (events.length) {
        await prisma.timesheetEvent.createMany({ data: events.map((e) => ({ timesheetId: ts.id, type: e.type, actorId: e.actorId, at: new Date(e.at), note: e.note ?? null })) });
      }
    };

    // Rémi Rejet : semaine 12 soumise mercredi, rejetée jeudi matin (avant l'horloge de démonstration).
    const reason = "Jeudi 19 mars : 7 h sur Refonte parcours souscription, à vérifier.";
    await sheet(
      staff.rejected.id,
      12,
      "REJECTED",
      [
        { ...line(refonte), hours: [6, 6, 6, 7, 6], flaggedDay: 3 },
        { ...line(veille), hours: [2, 2, 2, 1, 2] },
      ],
      [
        { type: "SUBMITTED", actorId: staff.rejected.id, at: "2026-03-18T15:00:00Z" },
        { type: "REJECTED", actorId: manager.id, at: "2026-03-19T07:00:00Z", note: reason },
      ],
      { submittedAt: "2026-03-18T15:00:00Z", decidedAt: "2026-03-19T07:00:00Z", reason },
    );

    // Nina Mobile : brouillon avec une ligne d'un projet terminé (lecture seule).
    await sheet(staff.mobile.id, 12, "DRAFT", [
      { ...line(usage), hours: [2, null, null, null, null] },
      { ...line(veille), hours: [6, 8, 8, null, null] },
    ]);

    // Fiches soumises, à valider ou rejeter.
    const full = (h: number) => [
      { ...line(refonte), hours: [h, h, h, h, h] },
      { ...line(veille), hours: [8 - h, 8 - h, 8 - h, 8 - h, 8 - h] },
    ];
    for (const [user, week, h, at] of [
      [staff.alice, 12, 6, "2026-03-18T16:00:00Z"],
      [staff.bruno, 12, 5, "2026-03-18T16:10:00Z"],
      [staff.chloe, 12, 4, "2026-03-18T16:20:00Z"],
      [staff.david, 11, 7, "2026-03-13T16:30:00Z"],
    ] as const) {
      await sheet(user.id, week, "SUBMITTED", full(h), [{ type: "SUBMITTED", actorId: user.id, at }], { submittedAt: at });
    }

    // Inès Stage : stagiaire de Martin Valideur. Février 2026 (semaines 6 à 9) validé,
    // fiche de présence générée et à signer ; l'adresse RH de la division est renseignée.
    await prisma.divisionSettings.update({ where: { divisionId: division.id }, data: { hrEmail: E2E_HR_EMAIL, hrAutoSend: true } });
    const internship = { kind: "ACADEMIC" as const, direction: "DEC", department: "CX", service: "Division de test", startDate: new Date("2026-02-02T00:00:00Z"), endDate: new Date("2026-07-31T00:00:00Z") };
    await prisma.internship.upsert({ where: { userId: staff.intern.id }, update: internship, create: { userId: staff.intern.id, ...internship } });
    await prisma.user.update({ where: { id: staff.intern.id }, data: { usualArrival: "08:30", usualDeparture: "17:30", defaultSignatureMode: "DRAWN" } });
    await prisma.attendanceSheet.deleteMany({ where: { divisionId: division.id } });
    for (const week of [6, 7, 8, 9]) {
      const monday = new Date(Date.UTC(2025, 11, 29 + (week - 1) * 7));
      await prisma.timesheet.create({
        data: {
          divisionId: division.id,
          userId: staff.intern.id,
          isoYear: 2026,
          isoWeek: week,
          status: "VALIDATED",
          submittedAt: plusDays(monday, 4),
          submissionCount: 1,
          decidedById: manager.id,
          decidedAt: plusDays(monday, 7),
          lines: {
            create: [{ ...line(veille), position: 0, entries: { create: [0, 1, 2, 3, 4].map((i) => ({ date: plusDays(monday, i), hours: 8 })) } }],
          },
        },
      });
    }
    await prisma.attendanceSheet.create({
      data: { divisionId: division.id, userId: staff.intern.id, year: 2026, month: 2, status: "GENERATED", generatedAt: new Date("2026-03-09T07:00:00Z") },
    });
  } finally {
    await prisma.$disconnect();
  }
}
