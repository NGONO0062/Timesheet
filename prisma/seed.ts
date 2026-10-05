// Données de démonstration (PROMPT.md §18) : elles reproduisent les maquettes,
// pour comparer écran par écran. Tous les noms sont fictifs, adresses en @exemple.com.
// Lancement : npm run db:seed (ou npm run db:reset pour repartir d'une base vide).
import prismaClient, { type ProjectStatus, type Role } from "@prisma/client";
import { argon2id } from "hash-wasm";

// @prisma/client est un module CommonJS : import par défaut sous Node en ESM.
const prisma = new prismaClient.PrismaClient();

const password = process.env.SEED_PASSWORD;
if (!password) {
  console.error("SEED_PASSWORD manquant : copiez .env.example en .env.");
  process.exit(1);
}

async function hash(pw: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return argon2id({ password: pw, salt, parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32, outputType: "encoded" });
}

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const email = (first: string, last: string) =>
  `${first}.${last}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "-") + "@exemple.com";

type Person = { first: string; last: string; role: Role; team?: string; manager?: string; active?: boolean };

// Équipes : Parcours (Samuel Etoga, 6), Études (Hélène Nkoa, 5), Data CX (Olivier Manga, 4).
const PEOPLE: Person[] = [
  { first: "Brigitte", last: "Mbarga", role: "OWNER" },
  { first: "Paul", last: "Tchouta", role: "DIVISION_ADMIN" },
  { first: "Samuel", last: "Etoga", role: "MANAGER", team: "Parcours", manager: "Brigitte Mbarga" },
  { first: "Hélène", last: "Nkoa", role: "MANAGER", team: "Études", manager: "Brigitte Mbarga" },
  { first: "Olivier", last: "Manga", role: "MANAGER", team: "Data CX", manager: "Brigitte Mbarga" },
  ...["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"].map((n) => staff(n, "Parcours", "Samuel Etoga")),
  ...["Christelle Nana", "Boris Mbida", "Estelle Owona", "Franck Ateba", "Nadège Fouda"].map((n) => staff(n, "Études", "Hélène Nkoa")),
  ...["Arnaud Biyong", "Carine Messi", "Thierry Eyenga", "Vanessa Ndzana"].map((n) => staff(n, "Data CX", "Olivier Manga")),
  { ...staff("Marie-Claire Abega", "Études", "Hélène Nkoa"), active: false },
];

function staff(name: string, team: string, manager: string): Person {
  const [first, ...rest] = name.split(" ");
  return { first: first!, last: rest.join(" "), role: "STAFF", team, manager };
}

type ProjectSeed = {
  code: string;
  name: string;
  start: string;
  end: string | null;
  budget: number | null;
  status: ProjectStatus;
  activities: string[];
  members: string[];
};

// Projets de l'équipe de Samuel Etoga (planche 09-Projets).
const PROJECTS: ProjectSeed[] = [
  { code: "CX-2026-00", name: "Veille et formation", start: "2026-01-01", end: "2026-12-31", budget: null, status: "IN_PROGRESS", activities: ["Formation"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-01", name: "Refonte parcours souscription", start: "2026-01-05", end: "2026-06-26", budget: 960, status: "IN_PROGRESS", activities: ["Tests utilisateurs", "Atelier"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya"] },
  { code: "CX-2026-02", name: "Baromètre NPS T1 2026", start: "2026-01-05", end: "2026-03-27", budget: 400, status: "IN_PROGRESS", activities: ["Analyse"], members: ["Aïcha Ndongo", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-03", name: "Cartographie des irritants", start: "2026-02-02", end: "2026-05-29", budget: 600, status: "IN_PROGRESS", activities: ["Atelier", "Rédaction"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-04", name: "Tests d'usage appli mobile", start: "2026-01-12", end: "2026-02-27", budget: 320, status: "DONE", activities: ["Tests utilisateurs"], members: ["Kevin Fotso", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-05", name: "Refonte FAQ en ligne", start: "2026-02-02", end: "2026-04-30", budget: 300, status: "ON_HOLD", activities: ["Rédaction"], members: ["Kevin Fotso", "Laure Bikoï"] },
  { code: "CX-2026-06", name: "Enquête boutiques T2 2026", start: "2026-04-06", end: "2026-06-26", budget: 240, status: "NOT_STARTED", activities: ["Enquête", "Analyse"], members: ["Aïcha Ndongo", "Ibrahim Njoya", "Yannick Essomba"] },
];

async function main() {
  const existing = await prisma.division.findUnique({ where: { slug: "cx-expertise" } });
  if (existing) {
    // Base déjà créée : on ajoute seulement les fiches qui manquent, sans rien effacer.
    const users = await prisma.user.findMany({ where: { divisionId: existing.id }, select: { id: true, firstName: true, lastName: true } });
    const projects = await prisma.project.findMany({ where: { divisionId: existing.id }, include: { activities: true } });
    const added = await seedTimesheets(
      existing.id,
      new Map(users.map((u) => [`${u.firstName} ${u.lastName}`, u.id])),
      new Map(projects.map((p) => [p.code, p])),
    );
    console.log(added > 0 ? `${added} fiche(s) de temps de démonstration ajoutée(s).` : "Données de démonstration déjà à jour. Pour repartir de zéro : npm run db:reset.");
    return;
  }
  const passwordHash = await hash(password!);
  const created = d("2026-01-05");

  const division = await prisma.division.create({
    data: {
      name: "CX Expertise",
      slug: "cx-expertise",
      direction: "DEC",
      department: "CX",
      service: "CX Expertise",
      status: "ACTIVE",
      onboardingStep: 5,
      createdAt: created,
      settings: { create: { hrEmail: null } },
    },
  });

  // Comptes, managers d'abord pour pouvoir rattacher les équipes.
  const ids = new Map<string, string>();
  for (const p of PEOPLE) {
    const user = await prisma.user.create({
      data: {
        divisionId: division.id,
        email: email(p.first, p.last),
        passwordHash,
        firstName: p.first,
        lastName: p.last,
        role: p.role,
        active: p.active ?? true,
        managerId: p.manager ? ids.get(p.manager) : null,
        createdAt: created,
      },
    });
    ids.set(`${p.first} ${p.last}`, user.id);
  }

  for (const [team, manager] of [["Parcours", "Samuel Etoga"], ["Études", "Hélène Nkoa"], ["Data CX", "Olivier Manga"]] as const) {
    const t = await prisma.team.create({ data: { divisionId: division.id, name: team, managerId: ids.get(manager)! } });
    const members = PEOPLE.filter((p) => p.team === team).map((p) => ids.get(`${p.first} ${p.last}`)!);
    await prisma.user.updateMany({ where: { id: { in: members } }, data: { teamId: t.id } });
  }

  // Aïcha Ndongo : stagiaire, stage professionnel du 05/01/2026 au 26/06/2026.
  await prisma.internship.create({
    data: {
      userId: ids.get("Aïcha Ndongo")!,
      kind: "PROFESSIONAL",
      direction: "DEC",
      department: "CX",
      service: "CX Expertise",
      startDate: d("2026-01-05"),
      endDate: d("2026-06-26"),
    },
  });

  const samuel = ids.get("Samuel Etoga")!;
  const projects = new Map<string, { id: string; activities: { id: string; name: string }[] }>();
  for (const p of PROJECTS) {
    const project = await prisma.project.create({
      include: { activities: true },
      data: {
        divisionId: division.id,
        code: p.code,
        name: p.name,
        startDate: d(p.start),
        endDate: p.end ? d(p.end) : null,
        budgetHours: p.budget,
        status: p.status,
        statusChangedAt: created,
        statusChangedById: samuel,
        activities: { create: p.activities.map((name) => ({ name })) },
        members: { create: p.members.map((m) => ({ userId: ids.get(m)! })) },
      },
    });
    projects.set(p.code, project);
  }

  // Activité système « Absence » (PROMPT.md §20) : compte dans le total du jour.
  await prisma.project.create({
    data: {
      divisionId: division.id,
      code: "ABSENCE",
      name: "Absence",
      startDate: d("2026-01-01"),
      status: "IN_PROGRESS",
      isSystem: true,
      statusChangedAt: created,
      activities: { create: [{ name: "Absence" }] },
    },
  });

  await seedTimesheets(division.id, ids, projects);

  // Admin plateforme : sans division.
  await prisma.user.create({
    data: { divisionId: null, email: "rose.ekambi@exemple.com", passwordHash, firstName: "Rose", lastName: "Ekambi", role: "PLATFORM_ADMIN", createdAt: created },
  });

  const active = PEOPLE.filter((p) => p.active !== false).length;
  console.log(`Division CX Expertise : ${active} comptes actifs, ${PEOPLE.length - active} désactivé, ${PROJECTS.length} projets. Admin plateforme : Rose Ekambi.`);
}

// ---------------------------------------------------------------------------
// Fiches de temps (écrans 02 à 05). Semaine de référence : 12 de 2026 (16–20 mars).
// ---------------------------------------------------------------------------

/** Heures par jour, du lundi au vendredi ; null pour une cellule laissée vide. */
type Line = [code: string, activity: string, hours: Array<number | null>];

function mondayOf(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000);
  return new Date(monday.getTime() + (week - 1) * 7 * 86_400_000);
}
const plusDays = (date: Date, n: number) => new Date(date.getTime() + n * 86_400_000);
/** Instant à Douala (UTC+1) : « 2026-03-20 16:42 ». */
const douala = (iso: string) => new Date(`${iso.replace(" ", "T")}:00+01:00`);

async function seedTimesheets(
  divisionId: string,
  ids: Map<string, string>,
  projects: Map<string, { id: string; activities: { id: string; name: string }[] }>,
): Promise<number> {
  const samuel = ids.get("Samuel Etoga")!;
  let added = 0;

  async function sheet(
    user: string,
    week: number,
    status: "DRAFT" | "SUBMITTED" | "REJECTED" | "VALIDATED",
    lines: Line[],
    extra: {
      submittedAt?: string;
      decidedAt?: string;
      reason?: string;
      flagged?: [number, number][];
      comment?: string;
      /** Soumission précédente, rejetée : la fiche arrive en « 2e soumission ». */
      previous?: { submittedAt: string; rejectedAt: string; reason: string };
    } = {},
  ) {
    const monday = mondayOf(2026, week);
    const userId = ids.get(user)!;
    if (await prisma.timesheet.findUnique({ where: { userId_isoYear_isoWeek: { userId, isoYear: 2026, isoWeek: week } } })) return;
    added++;
    const ts = await prisma.timesheet.create({
      data: {
        divisionId,
        userId,
        isoYear: 2026,
        isoWeek: week,
        status,
        comment: extra.comment ?? null,
        submittedAt: extra.submittedAt ? douala(extra.submittedAt) : null,
        submissionCount: extra.submittedAt ? (extra.previous ? 2 : 1) : 0,
        decidedById: extra.decidedAt ? samuel : null,
        decidedAt: extra.decidedAt ? douala(extra.decidedAt) : null,
        rejectionReason: extra.reason ?? null,
      },
    });
    for (const [i, [code, activityName, hours]] of lines.entries()) {
      const project = projects.get(code)!;
      const activity = project.activities.find((a) => a.name === activityName)!;
      await prisma.timesheetLine.create({
        data: {
          timesheetId: ts.id,
          projectId: project.id,
          activityId: activity.id,
          position: i,
          entries: {
            create: hours
              .flatMap((h, day) => (h === null ? [] : [{ date: plusDays(monday, day), hours: h, flagged: Boolean(extra.flagged?.some(([l, d]) => l === i && d === day)) }])),
          },
        },
      });
    }
    // Historique : « Brouillon créé » le lundi à 09:05, puis les soumissions et décisions.
    const mondayIso = monday.toISOString().slice(0, 10);
    await prisma.timesheetEvent.create({ data: { timesheetId: ts.id, type: "CREATED", actorId: userId, at: douala(`${mondayIso} 09:05`) } });
    if (extra.previous) {
      await prisma.timesheetEvent.createMany({
        data: [
          { timesheetId: ts.id, type: "SUBMITTED", actorId: userId, at: douala(extra.previous.submittedAt) },
          { timesheetId: ts.id, type: "REJECTED", actorId: samuel, at: douala(extra.previous.rejectedAt), note: extra.previous.reason },
        ],
      });
    }
    if (extra.submittedAt) await prisma.timesheetEvent.create({ data: { timesheetId: ts.id, type: "SUBMITTED", actorId: userId, at: douala(extra.submittedAt) } });
    if (extra.decidedAt) {
      await prisma.timesheetEvent.create({
        data: { timesheetId: ts.id, type: status === "REJECTED" ? "REJECTED" : "VALIDATED", actorId: samuel, at: douala(extra.decidedAt), note: extra.reason ?? null },
      });
    }
  }

  // Semaines validées : soumises le vendredi, validées le lundi suivant.
  const validated = (week: number) => {
    const friday = plusDays(mondayOf(2026, week), 4).toISOString().slice(0, 10);
    const nextMonday = plusDays(mondayOf(2026, week), 7).toISOString().slice(0, 10);
    return { submittedAt: `${friday} 16:30`, decidedAt: `${nextMonday} 10:00` };
  };
  const january: Line[] = [
    ["CX-2026-01", "Tests utilisateurs", [3, 3, 3, 3, 3]],
    ["CX-2026-02", "Analyse", [3, 3, 3, 3, 3]],
    ["CX-2026-00", "Formation", [2, 2, 2, 2, 2]],
  ];
  const february: Line[] = [
    ["CX-2026-01", "Tests utilisateurs", [3, 3, 3, 3, 3]],
    ["CX-2026-02", "Analyse", [2, 2, 2, 2, 2]],
    ["CX-2026-03", "Atelier", [2, 2, 2, 2, 2]],
    ["CX-2026-00", "Formation", [1, 1, 1, 1, 1]],
  ];

  // Aïcha Ndongo, stagiaire depuis le 5 janvier : semaines 2 à 10 validées,
  // semaine 11 non saisie (manquante), semaine 12 en brouillon (24 h sur 40).
  for (let week = 2; week <= 10; week++) await sheet("Aïcha Ndongo", week, "VALIDATED", week <= 5 ? january : february, validated(week));
  await sheet("Aïcha Ndongo", 12, "DRAFT", [
    ["CX-2026-01", "Tests utilisateurs", [4, 4, 3, null, null]],
    ["CX-2026-02", "Analyse", [2, 4, 3, null, null]],
    ["CX-2026-03", "Atelier", [2, 0, 2, null, null]],
  ]);

  // Kevin Fotso : semaine 12 rejetée, cellule du jeudi 19 signalée (écran 05).
  const kevinWeek: Line[] = [
    ["CX-2026-01", "Tests utilisateurs", [3, 3, 3, 3, 3]],
    ["CX-2026-03", "Atelier", [3, 3, 3, 3, 3]],
    ["CX-2026-00", "Formation", [2, 2, 2, 2, 2]],
  ];
  for (let week = 2; week <= 11; week++) await sheet("Kevin Fotso", week, "VALIDATED", week <= 5 ? kevinWeek.filter(([c]) => c !== "CX-2026-03").map(([c, a, h]) => [c, a, c === "CX-2026-01" ? [6, 6, 6, 6, 6] : h] as Line) : kevinWeek, validated(week));
  await sheet(
    "Kevin Fotso",
    12,
    "REJECTED",
    [
      ["CX-2026-01", "Tests utilisateurs", [4, 4, 3, 5, 4]],
      ["CX-2026-03", "Atelier", [2, 4, 3, 3, 2]],
      ["CX-2026-00", "Formation", [2, 0, 2, 0, 2]],
    ],
    {
      submittedAt: "2026-03-20 16:42",
      decidedAt: "2026-03-23 09:15",
      reason: "Jeudi 19 mars, 5 h déclarées sur Refonte parcours souscription alors que l'atelier de tests a été annulé. Merci de réaffecter ces heures.",
      flagged: [[0, 3]],
    },
  );

  // File de validation de Samuel Etoga (écran 07) : semaines 2 à 11 validées,
  // semaine 12 soumise ; Ibrahim Njoya en 2e soumission pour la semaine 11.
  const usual = (main: Line[0], activity: string): Line[] => [
    [main, activity, [6, 6, 6, 6, 6]],
    ["CX-2026-00", "Formation", [2, 2, 2, 2, 2]],
  ];
  const team: Array<[name: string, lines: Line[], lastValidated: number]> = [
    ["Laure Bikoï", usual("CX-2026-01", "Tests utilisateurs"), 11],
    ["Ibrahim Njoya", usual("CX-2026-01", "Tests utilisateurs"), 10],
    ["Sandrine Mvondo", usual("CX-2026-02", "Analyse"), 11],
    ["Yannick Essomba", usual("CX-2026-02", "Analyse"), 11],
  ];
  for (const [name, lines, last] of team) {
    for (let week = 2; week <= last; week++) await sheet(name, week, "VALIDATED", lines, validated(week));
  }
  await sheet("Laure Bikoï", 12, "SUBMITTED", [["CX-2026-01", "Tests utilisateurs", [5, 5, 5, 5, 5]], ["CX-2026-03", "Atelier", [3, 3, 3, 3, 3]]], { submittedAt: "2026-03-20 17:30" });
  await sheet(
    "Sandrine Mvondo",
    12,
    "SUBMITTED",
    [["CX-2026-02", "Analyse", [3, 3, 3, 3, 3]], ["CX-2026-03", "Atelier", [3, 3, 3, 3, 3]], ["CX-2026-00", "Formation", [2, 2, 2, 2, 2]]],
    { submittedAt: "2026-03-20 15:10" },
  );
  await sheet("Yannick Essomba", 12, "SUBMITTED", usual("CX-2026-02", "Analyse"), { submittedAt: "2026-03-20 17:48" });
  await sheet("Ibrahim Njoya", 11, "SUBMITTED", usual("CX-2026-01", "Tests utilisateurs"), {
    submittedAt: "2026-03-19 08:50",
    comment: "Heures du mercredi réparties entre les tests et la formation, comme demandé.",
    previous: { submittedAt: "2026-03-13 17:05", rejectedAt: "2026-03-16 10:20", reason: "Mercredi 11 mars : la formation manque. Merci de répartir les heures." },
  });

  // Fiche de présence de février 2026 d'Aïcha Ndongo : générée, à signer (écran 06).
  const aicha = ids.get("Aïcha Ndongo")!;
  if (!(await prisma.attendanceSheet.findUnique({ where: { userId_year_month: { userId: aicha, year: 2026, month: 2 } } }))) {
    await prisma.attendanceSheet.create({
      data: { divisionId, userId: aicha, year: 2026, month: 2, status: "GENERATED", generatedAt: douala("2026-03-09 08:00") },
    });
  }

  // Fiches créées avant l'événement « Brouillon créé » : on le rattrape (lundi, 09:05).
  const withoutCreated = await prisma.timesheet.findMany({ where: { divisionId, events: { none: { type: "CREATED" } } } });
  for (const ts of withoutCreated) {
    const mondayIso = mondayOf(ts.isoYear, ts.isoWeek).toISOString().slice(0, 10);
    await prisma.timesheetEvent.create({ data: { timesheetId: ts.id, type: "CREATED", actorId: ts.userId, at: douala(`${mondayIso} 09:05`) } });
  }
  return added;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
