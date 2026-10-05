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
  { code: "CX-2026-00", name: "Veille et formation", start: "2026-01-01", end: "2026-12-31", budget: null, status: "IN_PROGRESS", activities: ["Formation", "Veille"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-01", name: "Refonte parcours souscription", start: "2026-01-05", end: "2026-06-26", budget: 960, status: "IN_PROGRESS", activities: ["Tests utilisateurs", "Ateliers", "Rédaction"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Ibrahim Njoya"] },
  { code: "CX-2026-02", name: "Baromètre NPS T1 2026", start: "2026-01-05", end: "2026-03-27", budget: 400, status: "IN_PROGRESS", activities: ["Analyse", "Collecte"], members: ["Aïcha Ndongo", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-03", name: "Cartographie des irritants", start: "2026-02-02", end: "2026-05-29", budget: 600, status: "IN_PROGRESS", activities: ["Atelier", "Analyse"], members: ["Aïcha Ndongo", "Kevin Fotso", "Laure Bikoï", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-04", name: "Tests d'usage appli mobile", start: "2026-01-12", end: "2026-02-27", budget: 320, status: "DONE", activities: ["Tests utilisateurs"], members: ["Kevin Fotso", "Ibrahim Njoya", "Sandrine Mvondo", "Yannick Essomba"] },
  { code: "CX-2026-05", name: "Refonte FAQ en ligne", start: "2026-02-02", end: "2026-04-30", budget: 300, status: "ON_HOLD", activities: ["Rédaction"], members: ["Kevin Fotso", "Laure Bikoï"] },
  { code: "CX-2026-06", name: "Enquête boutiques T2 2026", start: "2026-04-06", end: "2026-06-26", budget: 240, status: "NOT_STARTED", activities: ["Préparation", "Collecte"], members: ["Aïcha Ndongo", "Ibrahim Njoya", "Yannick Essomba"] },
];

async function main() {
  if (await prisma.division.findUnique({ where: { slug: "cx-expertise" } })) {
    console.log("Données de démonstration déjà présentes. Pour repartir de zéro : npm run db:reset.");
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
  for (const p of PROJECTS) {
    await prisma.project.create({
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

  // Admin plateforme : sans division.
  await prisma.user.create({
    data: { divisionId: null, email: "rose.ekambi@exemple.com", passwordHash, firstName: "Rose", lastName: "Ekambi", role: "PLATFORM_ADMIN", createdAt: created },
  });

  const active = PEOPLE.filter((p) => p.active !== false).length;
  console.log(`Division CX Expertise : ${active} comptes actifs, ${PEOPLE.length - active} désactivé, ${PROJECTS.length} projets. Admin plateforme : Rose Ekambi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
