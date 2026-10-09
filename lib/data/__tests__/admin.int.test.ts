import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matrixOf } from "@/lib/admin/rules";
import { effectivePermissions } from "@/lib/permissions";
import { AdminRuleError, changeRole, getDivisionSettings, getMatrix, inviteUser, listUsersPage, saveMatrix, saveRules, setActive, updateUser } from "../admin";
import { AccessDenied, prisma, type DivisionScope } from "../db";
import { changePassword, getMySettings, saveUsualHours, setNotification, SettingsRuleError } from "../settings";
import { consumeToken, issueToken, peekToken } from "../tokens";

// Administration de division et paramètres (jalon 6), sur la base du seed. La division B
// est fixe et réutilisée : le journal d'audit, en ajout seul, la référence, elle ne peut
// donc pas être supprimée. Ses comptes et réglages sont remis à zéro à chaque exécution ;
// CX Expertise (A) n'est jamais modifiée.
const RUN = Date.now().toString(36);
const meta = { now: new Date("2026-03-19T09:00:00Z"), actorLabel: "Test Admin" };
let divisionA: string;
let divisionB: string;
let adminB: string;
let staffB: string;
let aicha: string;

const scope = (divisionId: string, userId: string, role: "DIVISION_ADMIN" | "STAFF" = "DIVISION_ADMIN"): DivisionScope => ({
  divisionId,
  userId,
  role,
  permissions: effectivePermissions(role),
});

beforeAll(async () => {
  divisionA = (await prisma.division.findUniqueOrThrow({ where: { slug: "cx-expertise" } })).id;
  aicha = (await prisma.user.findUniqueOrThrow({ where: { email: "aicha.ndongo@exemple.com" } })).id;
  const b = { name: "Division d'intégration (administration)", slug: "integration-administration", direction: "TEST", status: "ACTIVE" as const };
  divisionB = (await prisma.division.upsert({ where: { slug: b.slug }, update: b, create: b })).id;
  await cleanB();
  await prisma.divisionSettings.create({ data: { divisionId: divisionB } });
  adminB = (await prisma.user.create({ data: { divisionId: divisionB, email: `admin-${RUN}@exemple.com`, firstName: "Ada", lastName: "Admin", role: "DIVISION_ADMIN" } })).id;
  staffB = (await prisma.user.create({ data: { divisionId: divisionB, email: `staff-${RUN}@exemple.com`, firstName: "Sam", lastName: "Staff", role: "STAFF" } })).id;
});

async function cleanB() {
  await prisma.rolePermission.deleteMany({ where: { divisionId: divisionB } });
  await prisma.user.deleteMany({ where: { divisionId: divisionB } });
  await prisma.divisionSettings.deleteMany({ where: { divisionId: divisionB } });
}

afterAll(async () => {
  await cleanB();
  await prisma.$disconnect();
});

describe("isolation de l'administration entre divisions", () => {
  it("ne liste que les utilisateurs de sa division", async () => {
    const page = await listUsersPage(scope(divisionB, adminB), "", 1);
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => r.email).sort()).toEqual([`admin-${RUN}@exemple.com`, `staff-${RUN}@exemple.com`]);
    // Recherche d'une personne d'une autre division : rien.
    expect((await listUsersPage(scope(divisionB, adminB), "Ndongo", 1)).total).toBe(0);
  });

  it("refuse de modifier un utilisateur d'une autre division", async () => {
    await expect(changeRole(scope(divisionB, adminB), aicha, "MANAGER", meta)).rejects.toMatchObject({ code: "notFound" });
    await expect(setActive(scope(divisionB, adminB), aicha, false, meta)).rejects.toBeInstanceOf(AdminRuleError);
    await expect(updateUser(scope(divisionB, adminB), aicha, { firstName: "X", lastName: "Y", role: "STAFF", managerId: null }, meta)).rejects.toBeInstanceOf(AdminRuleError);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: aicha } });
    expect([after.role, after.active, after.firstName]).toEqual(["STAFF", true, "Aïcha"]);
  });

  it("refuse un manager pris dans une autre division", async () => {
    const samuel = (await prisma.user.findUniqueOrThrow({ where: { email: "samuel.etoga@exemple.com" } })).id;
    await expect(updateUser(scope(divisionB, adminB), staffB, { firstName: "Sam", lastName: "Staff", role: "STAFF", managerId: samuel }, meta)).rejects.toMatchObject({ code: "manager" });
  });

  it("enregistre permissions et règles dans sa division seulement", async () => {
    const before = await getMatrix(scope(divisionA, "lecture"));
    const m = matrixOf([]);
    await saveMatrix(scope(divisionB, adminB), { ...m, STAFF: ["ENTER_TIME", "VIEW_REPORTING"] }, meta);
    expect((await getMatrix(scope(divisionB, adminB))).STAFF).toContain("VIEW_REPORTING");
    expect(await getMatrix(scope(divisionA, "lecture"))).toEqual(before);

    const rulesA = (await getDivisionSettings(scope(divisionA, "lecture"))).rules;
    await saveRules(scope(divisionB, adminB), { ...rulesA, hoursPerDay: "7", step: 1 }, meta);
    expect((await getDivisionSettings(scope(divisionB, adminB))).rules).toMatchObject({ hoursPerDay: "7", step: 1 });
    expect((await getDivisionSettings(scope(divisionA, "lecture"))).rules).toEqual(rulesA);
  });

  it("exige la permission d'administrer", async () => {
    await expect(listUsersPage(scope(divisionB, staffB, "STAFF"), "", 1)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveMatrix(scope(divisionB, staffB, "STAFF"), matrixOf([]), meta)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("protège son propre compte et le dernier administrateur", async () => {
    await expect(changeRole(scope(divisionB, adminB), adminB, "STAFF", meta)).rejects.toMatchObject({ code: "self" });
    await expect(setActive(scope(divisionB, adminB), adminB, false, meta)).rejects.toMatchObject({ code: "self" });
    // Un autre admin ne peut pas retirer le rôle du dernier admin actif.
    await expect(changeRole(scope(divisionB, staffB), adminB, "STAFF", meta)).rejects.toMatchObject({ code: "lastAdmin" });
  });
});

describe("invitation", () => {
  it("crée un compte sans mot de passe, refuse une adresse déjà prise, puis le lien fixe le mot de passe", async () => {
    await expect(inviteUser(scope(divisionB, adminB), { email: "aicha.ndongo@exemple.com", firstName: "A", lastName: "B", role: "STAFF", managerId: null }, meta)).rejects.toMatchObject({ code: "emailTaken" });
    const r = await inviteUser(scope(divisionB, adminB), { email: `Nouveau-${RUN}@Exemple.com`, firstName: "Nora", lastName: "Nouvelle", role: "STAFF", managerId: null }, meta);
    expect(r.email).toBe(`nouveau-${RUN}@exemple.com`);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: r.email } });
    expect([user.divisionId, user.passwordHash]).toEqual([divisionB, null]);
    expect((await listUsersPage(scope(divisionB, adminB), "Nora", 1)).rows[0]?.invited).toBe(true);

    // Nouveau lien : l'ancien ne vaut plus ; un lien d'invitation n'est pas un lien de réinitialisation.
    const old = await issueToken(user.id, "INVITATION", meta.now);
    const token = await issueToken(user.id, "INVITATION", meta.now);
    expect(await peekToken(old, "INVITATION", meta.now)).toBeNull();
    expect(await peekToken(token, "RESET", meta.now)).toBeNull();
    expect(await peekToken(token, "INVITATION", new Date(meta.now.getTime() + 8 * 86_400_000))).toBeNull();
    expect(await peekToken(token, "INVITATION", meta.now)).toEqual({ firstName: "Nora", email: r.email });
    expect(await consumeToken(token, "INVITATION", "Orange-Cameroun-2026", meta.now)).toBe(true);
    expect(await consumeToken(token, "INVITATION", "Orange-Cameroun-2027", meta.now)).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toMatch(/^\$argon2id\$/);
  });
});

describe("paramètres de l'utilisateur connecté", () => {
  it("ne touche que sa propre ligne", async () => {
    await saveUsualHours({ userId: staffB }, "07:30", "16:30");
    const prev = await setNotification({ userId: staffB }, "validated", false);
    expect(prev).toBe(true);
    const mine = await getMySettings({ userId: staffB });
    expect([mine.usualArrival, mine.usualDeparture, mine.notifications.validated, mine.notifications.rejected]).toEqual(["07:30", "16:30", false, true]);
    const a = await prisma.user.findUniqueOrThrow({ where: { id: aicha } });
    expect([a.usualArrival, a.usualDeparture]).toEqual(["08:00", "17:00"]);
  });

  it("refuse des horaires mal formés ou inversés", async () => {
    await expect(saveUsualHours({ userId: staffB }, "8:00", "17:00")).rejects.toMatchObject({ code: "time" });
    await expect(saveUsualHours({ userId: staffB }, "17:00", "08:00")).rejects.toMatchObject({ code: "order" });
  });

  it("vérifie le mot de passe actuel avant de le changer", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `nouveau-${RUN}@exemple.com` } });
    await expect(changePassword({ userId: user.id }, "faux-mot-de-passe-1", "Orange-Cameroun-2028", "Orange-Cameroun-2028")).rejects.toMatchObject({ code: "wrongPassword" });
    await expect(changePassword({ userId: user.id }, "Orange-Cameroun-2026", "court1", "court1")).rejects.toBeInstanceOf(SettingsRuleError);
    await changePassword({ userId: user.id }, "Orange-Cameroun-2026", "Orange-Cameroun-2028", "Orange-Cameroun-2028");
    const failures = await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGED", objectLabel: user.email, result: "FAILURE" } });
    expect(failures).toBe(1);
  });
});
