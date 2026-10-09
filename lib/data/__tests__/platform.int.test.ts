import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matrixOf } from "@/lib/admin/rules";
import { parseAuditFilters } from "@/lib/audit/filters";
import { utcDate } from "@/lib/iso-week";
import { readMatrix, readSettings } from "../admin";
import { AccessDenied, prisma } from "../db";
import { finishOnboarding, getOnboarding, listAudit, listDivisions, PlatformRuleError, saveAdmin, saveIdentity, saveOnboardingRules, saveRolesAndWorkflow, setDivisionStatus } from "../platform";

// Administration plateforme (jalon 7), sur la base du seed. La division d'onboarding est
// fixe (« integration-plateforme ») : le journal d'audit, en ajout seul, la référence et
// interdit de la supprimer. Elle est remise en onboarding à chaque exécution.
const RUN = Date.now().toString(36);
const SLUG = "integration-plateforme";
const meta = { now: new Date("2026-03-19T09:00:00Z"), actorLabel: "Rose Ekambi" };
let rose: { userId: string; role: "PLATFORM_ADMIN" };
let divisionId: string;

beforeAll(async () => {
  rose = { userId: (await prisma.user.findUniqueOrThrow({ where: { email: "rose.ekambi@exemple.com" } })).id, role: "PLATFORM_ADMIN" };
  const data = { name: "Division d'intégration (plateforme)", slug: SLUG, direction: "TEST", status: "ONBOARDING" as const, onboardingStep: 2, configSource: null };
  divisionId = (await prisma.division.upsert({ where: { slug: SLUG }, update: data, create: data })).id;
  await prisma.rolePermission.deleteMany({ where: { divisionId } });
  await prisma.user.deleteMany({ where: { divisionId } });
  await prisma.divisionSettings.deleteMany({ where: { divisionId } });
  await prisma.divisionSettings.create({ data: { divisionId } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { divisionId } });
  await prisma.$disconnect();
});

describe("réservé à l'admin plateforme", () => {
  it("refuse tout autre rôle", async () => {
    const paul = (await prisma.user.findUniqueOrThrow({ where: { email: "paul.tchouta@exemple.com" } })).id;
    await expect(listDivisions({ userId: paul, role: "DIVISION_ADMIN" })).rejects.toBeInstanceOf(AccessDenied);
    const f = parseAuditFilters({}, utcDate(2026, 3, 19)).filters;
    await expect(listAudit({ userId: paul, role: "DIVISION_ADMIN" }, f)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("liste les divisions comme la planche 13", async () => {
    const cx = (await listDivisions(rose)).find((d) => d.slug === "cx-expertise");
    expect(cx).toMatchObject({ name: "CX Expertise", pilot: true, admin: "Paul Tchouta", status: "ACTIVE" });
    // 21 comptes au seed (planche 13) ; la démonstration peut en avoir ajouté.
    expect(cx!.users).toBeGreaterThanOrEqual(21);
  });
});

describe("journal d'audit", () => {
  it("filtre par période, type, division et texte", async () => {
    const week = parseAuditFilters({}, utcDate(2026, 3, 19)).filters;
    const all = await listAudit(rose, week);
    expect(all.rows[0]).toMatchObject({ actor: "Yannick Essomba", actorRole: "STAFF", division: "CX Expertise", action: "TIMESHEET_SUBMITTED", objectLabel: "Semaine 12", result: "SUCCESS" });
    const failure = all.rows.find((r) => r.action === "LOGIN_FAILURE" && r.objectLabel === "kevin.fotso@exemple.com");
    expect(failure).toMatchObject({ actor: null, actorRole: null, result: "FAILURE" });

    const rules = await listAudit(rose, parseAuditFilters({ type: "RULES", q: "seuil" }, utcDate(2026, 3, 19)).filters);
    expect(rules.rows.map((r) => r.objectLabel)).toContain("Seuil d'alerte de remplissage : 80 %");
    expect(rules.rows.every((r) => ["RULES_CHANGED", "WORKFLOW_CHANGED", "PERMISSIONS_CHANGED"].includes(r.action))).toBe(true);

    const elsewhere = await listAudit(rose, { ...week, divisionId });
    expect(elsewhere.rows.every((r) => r.division === "Division d'intégration (plateforme)")).toBe(true);
    const before = await listAudit(rose, parseAuditFilters({ du: "01/01/2025", au: "31/01/2025" }, utcDate(2026, 3, 19)).filters);
    expect(before.total).toBe(0);
  });
});

describe("onboarding d'une division", () => {
  it("refuse un identifiant déjà pris", async () => {
    await expect(saveIdentity(rose, null, { name: "Doublon", slug: "cx-expertise", direction: "DEC" }, meta)).rejects.toMatchObject({ code: "slugTaken" });
  });

  it("copie la configuration de la pilote, jamais ses données, puis active la division et invite l'admin", async () => {
    const email = `admin-plateforme-${RUN}@exemple.com`;
    await expect(saveAdmin(rose, divisionId, { fullName: "Paul Tchouta", email: "paul.tchouta@exemple.com", config: "COPY" }, meta)).rejects.toMatchObject({ code: "emailTaken" });
    await saveAdmin(rose, divisionId, { fullName: "Ada Nouvelle Admin", email, config: "COPY" }, meta);
    const cx = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
    expect(await readMatrix(divisionId)).toEqual(await readMatrix(cx));
    const [mine, pilot] = [await readSettings(divisionId), await readSettings(cx)];
    expect(mine.rules).toEqual(pilot.rules);
    // Aucune donnée : ni projet, ni fiche, ni autre compte que l'admin désigné.
    expect(await prisma.project.count({ where: { divisionId } })).toBe(0);
    expect(await prisma.timesheet.count({ where: { divisionId } })).toBe(0);
    expect(await prisma.user.findMany({ where: { divisionId }, select: { firstName: true, lastName: true, role: true, passwordHash: true } })).toEqual([
      { firstName: "Ada", lastName: "Nouvelle Admin", role: "DIVISION_ADMIN", passwordHash: null },
    ]);

    // Fin prématurée : il manque les étapes 3 et 4.
    await expect(finishOnboarding(rose, divisionId, meta)).rejects.toEqual(new PlatformRuleError("incomplete", 3));
    await saveRolesAndWorkflow(rose, divisionId, matrixOf([]), { ...mine.workflow, hrEmail: "rh@exemple.com" }, meta);
    await saveOnboardingRules(rose, divisionId, { ...mine.rules, hoursPerDay: "7,5" }, meta);
    expect((await getOnboarding(rose, divisionId)).step).toBe(5);

    expect(await finishOnboarding(rose, divisionId, meta)).toEqual({ name: "Division d'intégration (plateforme)", email });
    const d = await prisma.division.findUniqueOrThrow({ where: { id: divisionId } });
    expect(d.status).toBe("ACTIVE");
    const admin = await prisma.user.findUniqueOrThrow({ where: { email }, include: { passwordTokens: true } });
    expect(admin.passwordTokens.map((t) => t.kind)).toEqual(["INVITATION"]);
    await expect(getOnboarding(rose, divisionId)).rejects.toMatchObject({ code: "notFound" });

    // Suspension réversible.
    expect(await setDivisionStatus(rose, divisionId, "SUSPENDED", meta)).toEqual({ name: d.name, previous: "ACTIVE" });
    expect(await setDivisionStatus(rose, divisionId, "ACTIVE", meta)).toEqual({ name: d.name, previous: "SUSPENDED" });
  });
});
